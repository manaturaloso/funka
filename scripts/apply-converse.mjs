import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {fieldsSchema,linkSchema,statusSchema} from '../functions/lib/shared/orders.js';
import {request,root,apiRoot,checksum} from './firestore-snapshot.mjs';
const args=process.argv.slice(2),option=name=>{const i=args.indexOf(name);return i<0?undefined:args[i+1];};
export function encode(v){if(v===null)return {nullValue:null};if(typeof v==='string')return {stringValue:v};if(typeof v==='boolean')return {booleanValue:v};if(typeof v==='number'&&Number.isSafeInteger(v))return {integerValue:String(v)};if(typeof v==='number'&&Number.isFinite(v))return {doubleValue:v};if(Array.isArray(v))return {arrayValue:{values:v.map(encode)}};if(v&&typeof v==='object')return {mapValue:{fields:Object.fromEntries(Object.entries(v).map(([k,x])=>[k,encode(x)]))}};throw Error('Unsupported Firestore value');}
const fields=value=>encode(value).mapValue.fields;
function decode(v){if('nullValue' in v)return null;if('stringValue' in v)return v.stringValue;if('booleanValue' in v)return v.booleanValue;if('integerValue' in v)return Number(v.integerValue);if('doubleValue' in v)return v.doubleValue;if('arrayValue' in v)return (v.arrayValue.values||[]).map(decode);if('mapValue' in v)return Object.fromEntries(Object.entries(v.mapValue.fields||{}).map(([k,x])=>[k,decode(x)]));throw Error('Unexpected encoded value');}
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const timestamp=value=>value&&Number.isFinite(Date.parse(value))&&/^20\d\d-/.test(value);
export function validatePlan(p){
 if(p.format!=='funka-converse-plan-v1'||p.teamId!=='eq-andrea'||p.brandId!=='converse-pe'||!/^\w{20,80}$/.test(p.actorUid)||!/^[a-f0-9]{64}$/.test(p.sourceSha256)||!Array.isArray(p.orders)||!p.orders.length||p.orders.length>2000)throw Error('Plan out of scope');
 const ids=new Set();let sources=0;
 for(const item of p.orders){const o=item.order;if(!o||!/^converse-[a-f0-9]{64}$/.test(o.id)||ids.has(o.id)||o.teamId!==p.teamId||o.brandId!==p.brandId||o.createdBy!==p.actorUid||o.revision!==1||o.archived!==false||o.assigneeUid!==null||o.collaborators.length||o.assignedUids.length||o.pieces.length||o.deadlineMode!=='manual'||o.importSource?.sha256!==p.sourceSha256||o.importSource?.kind!=='converse-xlsx'||!o.importSource.versions.length)throw Error('Invalid order identity/source');
  fieldsSchema.parse(Object.fromEntries(['title','description','type','channel','priority','assigneeUid','collaborators','deadline'].map(k=>[k,o[k]])));statusSchema.parse(o.status);if(o.deliveryUrl)linkSchema.parse(o.deliveryUrl);for(const link of item.links)linkSchema.parse(link);if(item.comments.length>10000||[item.createdAt,item.deliveredAt,o.sourceAssignedAt,o.sourceDeliveredAt].some(v=>v!==null&&!timestamp(v)))throw Error('Invalid historical date/comment');
  fields(o);sources+=o.importSource.versions.length;ids.add(o.id);
 }
 if(sources!==p.sourceRows)throw Error('Source row count mismatch');return digest(p);
}
export async function apply(p,apply=false){
 const hash=validatePlan(p),base=`${root}/teams/${p.teamId}/brands/${p.brandId}`,job=`${root}/adminActivity/converse-${p.sourceSha256}`;
 const get=async names=>{const response=await request('POST',apiRoot+':batchGet',{documents:names});return new Map((Array.isArray(response)?response:[response]).map(r=>[r.found?.name||r.missing,r.found]));};
 const dependencyNames=[root+'/system/bootstrap',root+`/users/${p.actorUid}`,root+`/teams/${p.teamId}`,root+`/brands/${p.brandId}`,base,root+`/scopes/${p.teamId}__${p.brandId}`];
 const deps=await get(dependencyNames),user=deps.get(root+`/users/${p.actorUid}`),owner=deps.get(root+'/system/bootstrap');
 if(owner?.fields.uid?.stringValue!==p.actorUid||user?.fields.active?.booleanValue!==true||user?.fields.role?.stringValue!=='superadmin'||user?.fields.googleVerified?.booleanValue!==true||dependencyNames.some(n=>!deps.get(n))||dependencyNames.slice(2).some(n=>deps.get(n)?.fields.archived?.booleanValue===true))throw Error('Owner or scope invalid');
 let eligible=0,skipped=0;const existing=new Map();for(let i=0;i<p.orders.length;i+=100){for(const [name,d] of await get(p.orders.slice(i,i+100).map(x=>base+'/orders/'+x.order.id)))if(d)existing.set(name,d);}
 for(const item of p.orders){const old=existing.get(base+'/orders/'+item.order.id);if(old){if(old.fields.importSource?.mapValue?.fields?.sha256?.stringValue!==p.sourceSha256)throw Error('Existing order has a different source; refusing overwrite');skipped++;}else eligible++;}
 if(!apply)return {mode:'preview',hash,sourceRows:p.sourceRows,orders:p.orders.length,newOrders:eligible,existingOrders:skipped};
 if(!eligible)return {mode:'unchanged',hash,created:0,skipped};
 let created=0;const eligibleOrders=p.orders.filter(x=>!existing.has(base+'/orders/'+x.order.id));
 for(let offset=0;offset<eligibleOrders.length;offset+=30){
  const chunk=eligibleOrders.slice(offset,offset+30),guardName=root+'/system/sparkGuard',state=await get([guardName,job]),guard=state.get(guardName),previous=state.get(job);const writes=[];
  for(const item of chunk){const o=item.order,path=base+'/orders/'+o.id;
   const encoded=fields(o);if(item.createdAt)encoded.createdAt={timestampValue:item.createdAt};const transforms=[{fieldPath:'updatedAt',setToServerValue:'REQUEST_TIME'},{fieldPath:'importedAt',setToServerValue:'REQUEST_TIME'},...(!item.createdAt?[{fieldPath:'createdAt',setToServerValue:'REQUEST_TIME'}]:[])];
   writes.push({update:{name:path,fields:encoded},updateTransforms:transforms,currentDocument:{exists:false}});
   const child=(collection,id,data,date)=>{const f=fields(data);if(date)f.createdAt={timestampValue:date};writes.push({update:{name:`${path}/${collection}/${id}`,fields:f},...(!date?{updateTransforms:[{fieldPath:'createdAt',setToServerValue:'REQUEST_TIME'}]}:{}),currentDocument:{exists:false}});};
   child('activity','excel-import',{action:'created',actorUid:p.actorUid,revision:1,reason:'Importado de Excel; se conservan las versiones del origen y el estado '+o.status},null);
   if(item.comments.trim())child('comments','excel-original',{body:'Comentario original del Excel:\n'+item.comments,pieceId:null,mentionedUids:[],actorUid:p.actorUid,source:'converse-xlsx'},null);
   for(const [i,url] of item.links.entries())child('deliveries',`excel-${i}`,{url,pieceId:null,actorUid:p.actorUid,source:'converse-xlsx'},item.deliveredAt);
  }
  writes.push({update:{name:guardName,fields:fields({revision:Number(guard?.fields.revision?.integerValue||0)+1})},updateTransforms:[{fieldPath:'updatedAt',setToServerValue:'REQUEST_TIME'}],currentDocument:guard?{updateTime:guard.updateTime}:{exists:false}});
  writes.push({update:{name:job,fields:{...(previous?.fields.createdAt?{createdAt:previous.fields.createdAt}:{}),...fields({action:'Importación de Excel Converse',actorUid:p.actorUid,teamId:p.teamId,brandId:p.brandId,sourceSha256:p.sourceSha256,planHash:hash,sourceRows:p.sourceRows,orderCount:p.orders.length,importedOrders:Number(previous?.fields.importedOrders?.integerValue||0)+chunk.length,complete:offset+chunk.length===eligibleOrders.length})}},updateTransforms:[{fieldPath:'updatedAt',setToServerValue:'REQUEST_TIME'},...(!previous?[{fieldPath:'createdAt',setToServerValue:'REQUEST_TIME'}]:[])],currentDocument:previous?{updateTime:previous.updateTime}:{exists:false}});
  const checks=[...deps.values()].map(d=>({verify:d.name,currentDocument:{updateTime:d.updateTime}}));if(checks.length+writes.length>500)throw Error('Batch exceeds limit');await request('POST',apiRoot+':commit',{writes:[...checks,...writes]});created+=chunk.length;console.error(JSON.stringify({importProgress:{created,totalNew:eligible}}));
 }
 const verified=await applyVerify(p,get,base,new Set(eligibleOrders.map(x=>x.order.id)));return {mode:'imported',hash,created,skipped,...verified};
}
async function applyVerify(p,get,base,newIds){let count=0;for(let i=0;i<p.orders.length;i+=100){const chunk=p.orders.slice(i,i+100),actual=await get(chunk.map(x=>base+'/orders/'+x.order.id));for(const item of chunk){const d=actual.get(base+'/orders/'+item.order.id);if(d?.fields.importSource?.mapValue?.fields?.sha256?.stringValue!==p.sourceSha256)throw Error('Final verification failed');if(newIds.has(item.order.id)){const actualFields=Object.fromEntries(Object.keys(item.order).map(k=>[k,decode(d.fields[k])]));if(checksum(item.order)!==checksum(actualFields))throw Error('Imported values differ from the plan');}count++;}}return {verifiedOrders:count};}
if(resolve(process.argv[1]||'')===fileURLToPath(import.meta.url)){const file=option('--file');if(!file)throw Error('Specify --file');const p=JSON.parse(readFileSync(file,'utf8'));const hash=validatePlan(p);if(args.includes('--apply')&&option('--confirm')!==hash)throw Error('Apply requires the exact reviewed plan hash');console.log(JSON.stringify(await apply(p,args.includes('--apply'))));}
