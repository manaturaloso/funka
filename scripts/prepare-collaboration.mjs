// Rebuild private derived directories from existing, verified permissions.
// No users, scopes or orders are created/assigned by this migration.
import {mkdirSync,writeFileSync} from 'node:fs';
import {request,root,apiRoot} from './firestore-snapshot.mjs';
function decode(v){if('stringValue'in v)return v.stringValue;if('booleanValue'in v)return v.booleanValue;if('integerValue'in v)return Number(v.integerValue);if('nullValue'in v)return null;if('arrayValue'in v)return(v.arrayValue.values||[]).map(decode);if('mapValue'in v)return Object.fromEntries(Object.entries(v.mapValue.fields||{}).map(([k,x])=>[k,decode(x)]));return v.timestampValue;}
function encode(v){if(v===null)return{nullValue:null};if(Array.isArray(v))return{arrayValue:{values:v.map(encode)}};if(typeof v==='object')return{mapValue:{fields:Object.fromEntries(Object.entries(v).map(([k,x])=>[k,encode(x)]))}};if(typeof v==='boolean')return{booleanValue:v};if(typeof v==='number')return{integerValue:String(v)};return{stringValue:v};}
const data=d=>Object.fromEntries(Object.entries(d.fields||{}).map(([k,v])=>[k,decode(v)]));
async function list(path){const rows=[];let cursor;do{const result=await request('GET',apiRoot+'/'+path,undefined,{pageSize:200,...(cursor?{pageToken:cursor}:{})});rows.push(...result.documents||[]);cursor=result.nextPageToken;}while(cursor);return rows;}
const checks=new Map(),remember=d=>{checks.set(d.name,d);return d;};
async function get(path){const result=await request('POST',apiRoot+':batchGet',{documents:[root+'/'+path]});const row=(Array.isArray(result)?result:[result])[0];return row.found?remember(row.found):null;}
const bootstrap=await get('system/bootstrap'),ownerUid=data(bootstrap).uid,owner=await get('users/'+ownerUid);
if(data(owner).email!=='joel.yc23@gmail.com'||!data(owner).active||data(owner).role!=='superadmin')throw Error('El propietario general no coincide.');
const scopes=(await list('scopes')).map(remember),users=(await list('users')).map(remember),validScopes=[];
for(const row of scopes){const s=data(row),link=await get(`teams/${s.teamId}/brands/${s.brandId}`);if(link&&!data(link).archived)validScopes.push(s);}
const desired=new Map(),put=(path,value)=>desired.set(root+'/'+path,value);
for(const scope of validScopes)put(`teams/${scope.teamId}/brands/${scope.brandId}/collaboration/directory`,{uids:[]});
for(const row of users){const u=data(row),uid=row.name.split('/').at(-1),grants=(await list('users/'+uid+'/access')).map(remember),oldBrands=await list('users/'+uid+'/brandAccess');for(const old of oldBrands)desired.set(old.name,null);
 if(!u.active||!['member','superadmin'].includes(u.role))continue;
 const allowed=validScopes.filter(s=>uid===ownerUid||(grants.some(g=>{const a=data(g);return a.teamId===s.teamId&&a.brandId===s.brandId;})&&(!u.invitationId||(u.scopes||[]).some(a=>a.teamId===s.teamId&&a.brandId===s.brandId))));
 for(const scope of allowed){const base=`teams/${scope.teamId}/brands/${scope.brandId}`;desired.get(root+'/'+base+'/collaboration/directory').uids.push(uid);put(base+'/people/'+uid,{uid,displayName:u.displayName||'Integrante'});if(uid!==ownerUid)put(`users/${uid}/brandAccess/${scope.brandId}`,{teamId:scope.teamId,brandId:scope.brandId});}
}
const changes=[];for(const[name,value]of desired){const old=await get(name.slice(root.length+1));if(JSON.stringify(old?data(old):null)!==JSON.stringify(value))changes.push({name,value,old});}
console.log(JSON.stringify({mode:process.argv.includes('--apply')?'apply':'preview',scopes:validScopes.length,activeUsers:users.filter(u=>data(u).active).length,derivedChanges:changes.length}));
if(process.argv.includes('--apply')&&changes.length){
 const guard=await get('system/sparkGuard'),stamp=new Date().toISOString(),guardData=guard?data(guard):{revision:0};
 const writes=changes.map(c=>c.value===null?{delete:c.name,currentDocument:{updateTime:c.old.updateTime}}:{update:{name:c.name,fields:encode(c.value).mapValue.fields},currentDocument:c.old?{updateTime:c.old.updateTime}:{exists:false}});
 const changed=new Set(changes.map(c=>c.name));for(const d of checks.values())if(!changed.has(d.name)&&d.name!==root+'/system/sparkGuard')writes.push({verify:d.name,currentDocument:{updateTime:d.updateTime}});
 writes.push({update:{name:root+'/system/sparkGuard',fields:{revision:{integerValue:String(guardData.revision+1)},updatedAt:{timestampValue:stamp}}},currentDocument:guard?{updateTime:guard.updateTime}:{exists:false}});
 writes.push({update:{name:root+'/adminActivity/collaboration-preparation-'+Date.now(),fields:encode({action:'collaborationPrepared',actorUid:ownerUid,actorEmail:'joel.yc23@gmail.com',scopes:validScopes.length,derivedChanges:changes.length}).mapValue.fields},updateTransforms:[{fieldPath:'createdAt',setToServerValue:'REQUEST_TIME'}],currentDocument:{exists:false}});
 if(writes.length>490)throw Error('La preparación supera el límite atómico; no se modificó nada.');
 mkdirSync('.local-backups',{recursive:true});writeFileSync('.local-backups/collaboration-'+Date.now()+'.json',JSON.stringify({project:'funka-joel-2026',changes}),{mode:0o600});
 await request('POST',apiRoot+':commit',{writes});console.log(JSON.stringify({applied:changes.length,atomic:true}));
}
