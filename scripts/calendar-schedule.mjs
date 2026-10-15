import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
export function quotaResumeAt(now=new Date()){
 const values=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/Los_Angeles',year:'numeric',month:'numeric',day:'numeric'}).formatToParts(now).map(p=>[p.type,p.value]));
 // 08:30 UTC is after midnight Pacific in both summer and winter.
 return new Date(Date.UTC(+values.year,+values.month-1,+values.day+1,8,30)).toISOString();
}
export function quotaPaused(value,now=new Date()){const until=Date.parse(value?.notBefore);return value?.format==='funka-calendar-quota-v1'&&Number.isFinite(until)&&until>now.getTime()&&until-now.getTime()<26*3600000;}
export function calendarOutcome(result,now=new Date()){
 if(result.status===0)return {exit:0,status:'completed'};
 if(String(result.stderr).includes('Firebase rechazó la operación (429; RESOURCE_EXHAUSTED).'))return {exit:0,status:'deferred-quota',cooldown:{format:'funka-calendar-quota-v1',notBefore:quotaResumeAt(now)}};
 return {exit:result.status||1,status:'failed'};
}
if(resolve(process.argv[1]||'')===fileURLToPath(import.meta.url)){
 const file='.calendar-runtime/cooldown.json';mkdirSync(dirname(file),{recursive:true});let saved={};try{saved=JSON.parse(readFileSync(file,'utf8'));}catch{}
 if(process.argv.includes('--check')){const paused=quotaPaused(saved);if(!paused)writeFileSync(file,'{}');if(process.env.GITHUB_OUTPUT)writeFileSync(process.env.GITHUB_OUTPUT,`ready=${!paused}\n`,{flag:'a'});console.log(JSON.stringify({status:paused?'deferred-quota':'ready',...(paused?{notBefore:saved.notBefore}:{})}));}
 else if(quotaPaused(saved)){console.log(JSON.stringify({status:'deferred-quota',notBefore:saved.notBefore}));}
 else{const result=spawnSync(process.execPath,['scripts/sync-calendar.mjs','--apply',...(process.argv.includes('--force')?['--force']:[])],{encoding:'utf8',maxBuffer:1024*1024});if(result.stdout)process.stdout.write(result.stdout);const outcome=calendarOutcome(result);if(outcome.cooldown){writeFileSync(file,JSON.stringify(outcome.cooldown));console.warn(`::warning::Sincronización incompleta por cuota gratuita de Firebase. Se retomará después de ${outcome.cooldown.notBefore}. Lo confirmado se conserva.`);console.log(JSON.stringify({status:outcome.status,...outcome.cooldown}));}else{if(result.stderr)process.stderr.write(result.stderr);writeFileSync(file,'{}');}process.exitCode=outcome.exit;}
}
