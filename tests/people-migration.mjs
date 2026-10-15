import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const host=process.env.FIRESTORE_EMULATOR_HOST;if(!host||!/^127\.0\.0\.1:[0-9]+$/.test(host))throw Error('Solo emulador local');const root=`http://${host}/v1/projects/demo-funka/databases/(default)/documents`;
const stringValue=s=>({stringValue:s}),booleanValue=b=>({booleanValue:b});
async function save(path,fields){const r=await fetch(root+'/'+path,{method:'PATCH',headers:{Authorization:'Bearer owner','Content-Type':'application/json'},body:JSON.stringify({fields})});assert(r.ok,await r.text());}
for(const [uid,role,active,verified]of [['owner','superadmin',true,true],['member','member',true,true],['inactive','member',false,true],['unverified','member',true,false]])await save('users/'+uid,{displayName:stringValue(uid),role:stringValue(role),active:booleanValue(active),googleVerified:booleanValue(verified)});
for(const scope of ['a','b'])await save(`teams/t/brands/${scope}`,{archived:booleanValue(false)});
for(const uid of ['member','inactive','unverified'])await save(`users/${uid}/access/t__a`,{teamId:stringValue('t'),brandId:stringValue('a')});
function run(apply){const result=spawnSync(process.execPath,['scripts/rebuild-people.mjs','--emulator','--project','demo-funka',...(apply?['--apply']:[])],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);return JSON.parse(result.stdout.trim());}
assert.deepEqual(run(false),{mode:'preview',scopes:2,upserts:3});assert.deepEqual(run(true),{mode:'updated',upserts:3,scopes:2});
for(const [scope,names]of [['a',['member','owner']],['b',['owner']]]){const response=await fetch(root+`/teams/t/brands/${scope}/people`,{headers:{Authorization:'Bearer owner'}}),body=await response.json();assert.deepEqual(body.documents.map(d=>d.name.split('/').at(-1)).sort(),names);for(const d of body.documents)assert.deepEqual(Object.keys(d.fields).sort(),['displayName','uid']);}
assert.deepEqual(run(true),{mode:'unchanged',upserts:0});console.log('4 comprobaciones de directorio aprobadas: preview, aplicación, aislamiento/privacidad e idempotencia.');
