export interface CalendarRow {id:string;sheet:string;range:string;title:string;start:string;end:string;channelHints:('WP'|'SIS')[];issues:string[]}
export interface CalendarRecord {id:string;title:string;start:string;end:string;revision:number;reviewed:boolean;channels:string[];teamId:string|null;brandId:string|null;source:Omit<CalendarRow,'id'|'channelHints'> & {channelHints?:('WP'|'SIS')[]};sourceLatest?:Omit<CalendarRow,'id'>;syncStatus?:string;sourceMissing?:boolean;[key:string]:unknown}
export const normalizeCalendarText=(v:string)=>v.normalize('NFKD').replace(/\p{Diacritic}/gu,'').trim().replace(/\s+/g,' ').toLocaleUpperCase('es');
const canonical=(v:unknown):unknown=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>[k,canonical(x)])):v;
const latest=(r:CalendarRecord)=>r.sourceLatest||{...r.source,channelHints:r.source.channelHints||r.channels.filter((c):c is 'WP'|'SIS'=>c==='WP'||c==='SIS')};
const signature=(r:Pick<CalendarRow,'sheet'|'title'|'start'|'end'>)=>JSON.stringify([normalizeCalendarText(r.sheet),normalizeCalendarText(r.title),r.start,r.end]);
const location=(r:Pick<CalendarRow,'sheet'|'range'>)=>JSON.stringify([normalizeCalendarText(r.sheet),r.range]);
const titleKey=(r:Pick<CalendarRow,'sheet'|'title'>)=>JSON.stringify([normalizeCalendarText(r.sheet),normalizeCalendarText(r.title)]);
export interface CalendarMatch {record:CalendarRecord;row:CalendarRow;match:'exact'|'title'|'decision'}
export interface CalendarAmbiguity {row:CalendarRow;candidates:string[];reason:string}
export interface CalendarDecision {campaignId:string|null;sourceSignature:string}
export function reconcileCalendar(previous:CalendarRecord[],incoming:CalendarRow[],decisions:Record<string,CalendarDecision>={}){
 const usedOld=new Set<string>(),usedNew=new Set<string>(),matches:CalendarMatch[]=[],ambiguities:CalendarAmbiguity[]=[],fresh:CalendarRow[]=[];
 const pair=(old:CalendarRecord,row:CalendarRow,match:CalendarMatch['match'])=>{usedOld.add(old.id);usedNew.add(row.id);matches.push({record:old,row,match});};
 const by=<T,>(rows:T[],key:(r:T)=>string)=>{const m=new Map<string,T[]>();for(const r of rows){const k=key(r);m.set(k,[...m.get(k)||[],r]);}return m;};
 // Exact source identity survives row movements. Duplicates match only at an
 // unchanged position; never select an arbitrary member of a duplicate group.
 const exactOld=by(previous,r=>signature(latest(r))),exactNew=by(incoming,signature);
 for(const [key,rows]of exactNew){const old=exactOld.get(key)||[];if(rows.length===1&&old.length===1){pair(old[0],rows[0],'exact');continue;}for(const row of rows){const same=old.filter(o=>!usedOld.has(o.id)&&location(latest(o))===location(row));if(same.length===1)pair(same[0],row,'exact');}}
 // Original identity also survives a later revert of a previously edited row.
 for(const row of incoming.filter(r=>!usedNew.has(r.id))){const old=previous.filter(o=>!usedOld.has(o.id)&&signature(o.source)===signature(row)),same=incoming.filter(r=>!usedNew.has(r.id)&&signature(r)===signature(row));if(old.length===1&&same.length===1)pair(old[0],row,'exact');}
 // A unique title within its sheet identifies date changes, even with moved rows.
 const namesOld=by(previous.filter(o=>!usedOld.has(o.id)),r=>titleKey(latest(r))),namesNew=by(incoming.filter(r=>!usedNew.has(r.id)),titleKey);
 for(const [key,rows]of namesNew){const old=namesOld.get(key)||[];if(rows.length===1&&old.length===1)pair(old[0],rows[0],'title');}
 for(const row of incoming.filter(r=>!usedNew.has(r.id))){
  const candidates=previous.filter(o=>!usedOld.has(o.id)&&(signature(latest(o))===signature(row)||titleKey(latest(o))===titleKey(row)||location(latest(o))===location(row)||signature(o.source)===signature(row)||o.id===row.id));
  const decision=decisions[row.id];
  if(decision&&decision.sourceSignature===signature(row)){
   if(decision.campaignId===null){usedNew.add(row.id);fresh.push(row);continue;}
   const old=candidates.find(o=>o.id===decision.campaignId);if(old){pair(old,row,'decision');continue;}
  }
  const occupied=previous.some(o=>usedOld.has(o.id)&&(signature(o.source)===signature(row)||o.id===row.id));
  if(candidates.length||occupied){ambiguities.push({row,candidates:candidates.map(c=>c.id),reason:'Confirma si corresponde a una campaña existente o a una nueva.'});usedNew.add(row.id);}
  else fresh.push(row);
 }
 const uncertain=new Set(ambiguities.flatMap(a=>a.candidates));
 return {matches,fresh,ambiguities,missing:previous.filter(o=>!usedOld.has(o.id)&&!uncertain.has(o.id)),signature};
}
export function mergeCalendarSource(record:CalendarRecord,row:CalendarRow){
 const old=latest(record),fields:Record<string,unknown>={},conflicts:string[]=[];
 for(const key of ['title','start','end'] as const){if(record[key]===old[key]){if(record[key]!==row[key])fields[key]=row[key];}else if(row[key]!==old[key]&&row[key]!==record[key])conflicts.push(key);}
 if((record.sourceLatest||record.source.channelHints)&&JSON.stringify([...(old.channelHints||[])].sort())!==JSON.stringify([...row.channelHints].sort())&&record.reviewed)conflicts.push('channels');
 const sourceLatest={sheet:row.sheet,range:row.range,title:row.title,start:row.start,end:row.end,channelHints:row.channelHints,issues:row.issues};
 const changed=Object.keys(fields).length>0||record.sourceMissing===true||JSON.stringify(canonical(sourceLatest))!==JSON.stringify(canonical({sheet:old.sheet,range:old.range,title:old.title,start:old.start,end:old.end,channelHints:old.channelHints||[],issues:old.issues}));
 return {changed,fields,sourceLatest,conflicts,status:conflicts.length?'manual':'updated'};
}
export function automaticDeadline(start:string,days:number,hour:string){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(start)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(hour)||!Number.isInteger(days)||days<1||days>30)throw Error('Configuración de fecha automática inválida.');
 const n=Date.parse(`${start}T${hour}:00-05:00`);if(!Number.isFinite(n))throw Error('Fecha de campaña inválida.');return new Date(n-days*86400000).toISOString();
}
export function calendarOrderChange(campaign:Pick<CalendarRecord,'id'|'revision'|'start'|'end'|'teamId'|'brandId'>,marker:Record<string,unknown>,order:Record<string,any>,config:{autoDeadlineDays:number;deliveryHour:string}){
 if(marker.mode!=='created')return {reason:'linked' as const};
 if(marker.teamId!==campaign.teamId||marker.brandId!==campaign.brandId||order.teamId!==campaign.teamId||order.brandId!==campaign.brandId||order.campaign?.id!==campaign.id)return {reason:'association' as const};
 if(order.archived||order.status==='Entregado')return {reason:'closed' as const};
 if(order.deadlineMode!=='automatic')return {reason:'manual' as const};
 const deadline=automaticDeadline(campaign.start,config.autoDeadlineDays,config.deliveryHour),nextCampaign={...order.campaign,id:campaign.id,revision:campaign.revision,start:campaign.start,end:campaign.end};
 if(order.deadline===deadline&&JSON.stringify(order.campaign)===JSON.stringify(nextCampaign))return {reason:'unchanged' as const};
 return {fields:{deadline,campaign:nextCampaign,revision:order.revision+1},before:{deadline:order.deadline,campaign:order.campaign},after:{deadline,campaign:nextCampaign}};
}
export function calendarDue(now:Date,hour:string,state:{lastSuccessDay?:string;lastRequestId?:string;status?:string},requestId:string|null){
 const parts=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Lima',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(now),[day,time]=parts.split(' ');
 return {day,due:state.status==='error'||Boolean(requestId&&requestId!==state.lastRequestId)||(time>=hour&&state.lastSuccessDay!==day)};
}
