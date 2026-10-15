import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,renameSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
const require=createRequire(new URL('../package.json',import.meta.url));
const args=process.argv.slice(2),option=(name,fallback)=>{const i=args.indexOf(name);return i<0?fallback:args[i+1];};
const mode=option('--mode','backup'),emulator=args.includes('--emulator'),project=option('--project',emulator?'demo-funka':'funka-joel-2026');
if(project!==(emulator?'demo-funka':'funka-joel-2026'))throw new Error('Proyecto fuera del alcance autorizado.');
const root=`projects/${project}/databases/(default)/documents`,apiRoot='/v1/'+root;
let client;
if(!emulator){const {requireAuth}=require('firebase-tools/lib/requireAuth');await requireAuth({nonInteractive:true});const {Client}=require('firebase-tools/lib/apiv2');client=new Client({urlPrefix:'https://firestore.googleapis.com'});}
const host=process.env.FIRESTORE_EMULATOR_HOST;
if(emulator&&(!host||!/^127\.0\.0\.1:[0-9]+$/.test(host)))throw new Error('Restauración de prueba solo en el emulador local 127.0.0.1.');
async function request(method,path,body,queryParams={}){
 if(!emulator){const response=method==='GET'?await client.get(path,{queryParams}):await client.post(path,body,{queryParams});return response.body;}
 const u=new URL('http://'+host+path);for(const [k,v]of Object.entries(queryParams))if(v!==undefined)u.searchParams.set(k,String(v));const response=await fetch(u,{method,headers:{Authorization:'Bearer owner','Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});if(!response.ok)throw new Error(`Firestore respondió ${response.status}: ${await response.text()}`);return response.json();
}
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>[k,canonical(v)])):value;
const checksum=documents=>createHash('sha256').update(JSON.stringify(canonical(documents))).digest('hex');
async function snapshot(){
 const anchor=await request('POST',apiRoot+':batchGet',{documents:[root+'/system/bootstrap']});const stream=Array.isArray(anchor)?anchor:[anchor];const readTime=stream.find(x=>x.readTime)?.readTime;if(!readTime)throw new Error('No se obtuvo una fecha consistente de lectura.');
 const documents=[];let bytes=0;
 async function collections(parent){let pageToken;do{const data=await request('POST','/v1/'+parent+':listCollectionIds',{pageSize:100,...(pageToken?{pageToken}:{}),...(!emulator?{readTime}:{})});for(const id of data.collectionIds||[]){if(id.includes('/'))throw new Error('Colección inesperada.');let cursor;do{const page=await request('GET','/v1/'+parent+'/'+encodeURIComponent(id),undefined,{pageSize:25,showMissing:true,...(!emulator?{readTime}:{}),...(cursor?{pageToken:cursor}:{})});for(const document of page.documents||[]){if(!document.name.startsWith(root+'/'))throw new Error('Documento fuera del proyecto.');if(document.fields||document.createTime||document.updateTime){document.fields ||= {};documents.push(document);bytes+=Buffer.byteLength(JSON.stringify(document));if(documents.length>10000||bytes>32*1024*1024)throw new Error('El respaldo supera 10000 documentos o 32 MiB. No se guardó un archivo parcial.');}await collections(document.name);}cursor=page.nextPageToken;}while(cursor);}pageToken=data.nextPageToken;}while(pageToken);}
 await collections(root);documents.sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0);return {format:'funka-firestore-v1',projectId:project,readTime,consistentRead:!emulator,documentCount:documents.length,documents,sha256:checksum(documents)};
}
export {snapshot,request,checksum,root,apiRoot};
if(resolve(process.argv[1]||'')===fileURLToPath(import.meta.url)){
if(mode==='backup'){
 const data=await snapshot(),file=resolve(option('--file',`.local-backups/${project}-${new Date().toISOString().replaceAll(':','-')}.json`));mkdirSync(dirname(file),{recursive:true});writeFileSync(file+'.partial',JSON.stringify(data),{mode:0o600});renameSync(file+'.partial',file);console.log(JSON.stringify({file,documents:data.documentCount,readTime:data.readTime,consistentRead:data.consistentRead,sha256:data.sha256}));
}else if(mode==='restore'){
 const file=option('--file');if(!file)throw new Error('Indica --file.');const raw=readFileSync(file);if(raw.length>40*1024*1024)throw new Error('Archivo demasiado grande.');const data=JSON.parse(raw.toString());if(data.format!=='funka-firestore-v1'||!['funka-joel-2026','demo-funka'].includes(data.projectId)||!Array.isArray(data.documents)||data.documents.length>10000||data.documentCount!==data.documents.length||data.sha256!==checksum(data.documents))throw new Error('Formato, conteo o checksum inválido.');if(!emulator&&data.projectId!==project)throw new Error('No se restaura otro proyecto en producción.');
 const source=`projects/${data.projectId}/databases/(default)/documents/`,names=new Set();for(const d of data.documents){if(typeof d.name!=='string'||!d.name.startsWith(source)||!d.fields||typeof d.fields!=='object'||Array.isArray(d.fields))throw new Error('Documento inválido.');const path=d.name.slice(source.length);if(path.split('/').length%2!==0||path.split('/').some(x=>!x||/[\x00-\x1f]/.test(x))||names.has(path))throw new Error('Ruta inválida o repetida.');names.add(path);}
 if(!args.includes('--apply')){console.log(JSON.stringify({mode:'preview',project,documents:data.documentCount,sha256:data.sha256,requiresEmptyDatabase:true}));}
 else{if(option('--confirm')!==data.sha256)throw new Error('Confirma el checksum completo con --confirm.');const current=await snapshot();if(current.documentCount)throw new Error('La base no está vacía. No se sobrescribió ni borró ningún documento.');let written=0;for(let i=0;i<data.documents.length;i+=200){const writes=data.documents.slice(i,i+200).map(d=>({update:{name:root+'/'+d.name.slice(source.length),fields:d.fields},currentDocument:{exists:false}}));await request('POST',apiRoot+':commit',{writes});written+=writes.length;}const restored=await snapshot();const expected=data.documents.map(d=>({name:root+'/'+d.name.slice(source.length),fields:d.fields})).sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0),actual=restored.documents.map(d=>({name:d.name,fields:d.fields}));if(checksum(expected)!==checksum(actual))throw new Error('La verificación final no coincide; revisar el destino antes de usarlo.');console.log(JSON.stringify({mode:'restored',project,written,verified:true}));}
}else throw new Error('Modo desconocido.');

}
