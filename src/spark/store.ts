import {auditValue} from './audit-summary';
import { collection, collectionGroup, doc, documentId, getDocFromServer, getDocsFromServer, limit, orderBy, query, runTransaction, serverTimestamp, startAfter, Timestamp, where, type DocumentData, type DocumentSnapshot, type Query, type Transaction as WebTransaction } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

export { Timestamp };
export const FieldValue = { serverTimestamp };
export const FieldPath = { documentId };
export const randomUUID = () => crypto.randomUUID();
export async function sha256(value:string) {return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),v=>v.toString(16).padStart(2,'0')).join('');}
export class HttpsError extends Error { constructor(public code:string,message:string){super(message);} }
export function onCall<T>(_options:unknown,handler:(request:{auth:{uid:string}|null;data:unknown})=>Promise<T>){return async(data:unknown)=>handler({auth:auth?.currentUser?{uid:auth.currentUser.uid}:null,data});}
function database(){if(!db)throw new Error('Firebase no está configurado.');return db;}
export class Ref {
  constructor(public path:string){}
  get id(){return this.path.split('/').at(-1)!;}
  get parent(){return new Collection(this.path.split('/').slice(0,-1).join('/'));}
  collection(name:string){return new Collection(`${this.path}/${name}`);}
}
export class Collection {
  constructor(public path:string,public value:Query<DocumentData>=collection(database(),path)){}
  get id(){return this.path.split('/').at(-1)!;}
  get parent(){return this.path.includes('/')?new Ref(this.path.split('/').slice(0,-1).join('/')):null;}
  doc(id:string=crypto.randomUUID()){return new Ref(`${this.path}/${id}`);}
  where(field:string,op:Parameters<typeof where>[1],value:unknown){return new Collection(this.path,query(this.value,where(field,op,value)));}
  orderBy(field:Parameters<typeof orderBy>[0],direction:'asc'|'desc'='asc'){return new Collection(this.path,query(this.value,orderBy(field,direction)));}
  limit(n:number){return new Collection(this.path,query(this.value,limit(n)));}
  startAfter(value:unknown){return new Collection(this.path,query(this.value,startAfter(value instanceof Snapshot?value.raw:value)));}
}
export class Snapshot {
  constructor(public raw:DocumentSnapshot<DocumentData>){}
  get exists(){return this.raw.exists();}
  get id(){return this.raw.id;}
  get ref(){return new Ref(this.raw.ref.path);}
  data():DocumentData {return this.raw.data()!;}
}
export interface QuerySnapshot {docs:Snapshot[];size:number;empty:boolean}
export class Transaction {
  writes=0;hasAudit=false;activityAction='';
  private before=new Map<string,DocumentData|null>();
  changes:{path:string;operation:string;fields:string[];before:unknown;after:unknown}[]=[];
  private record(ref:Ref,value:DocumentData|null,operation:string){
    if(ref.path.startsWith('adminActivity/')){this.hasAudit=true;return;}
    if(ref.path.includes('/activity/')){this.activityAction=String(value?.action||'');return;}
    if(!(/^teams\/[^/]+\/brands\/[^/]+\/orders\/[^/]+$/.test(ref.path)||/^recurrences\/[^/]+$/.test(ref.path)))return;
    const before=this.before.get(ref.path)||null,after=value===null?null:operation==='update'?{...before,...value}:value;
    const keys=[...new Set([...Object.keys(before||{}),...Object.keys(after||{})])].filter(k=>!['updatedAt','createdAt'].includes(k)&&JSON.stringify(before?.[k])!==JSON.stringify(after?.[k]));
    this.changes.push({path:ref.path,operation,fields:keys,before:auditValue(before),after:auditValue(after)});
  }
  constructor(private tx:WebTransaction){}
  async get(ref:Ref):Promise<Snapshot>;
  async get(ref:Collection):Promise<QuerySnapshot>;
  async get(ref:Ref|Collection):Promise<Snapshot|QuerySnapshot>{
    if(ref instanceof Ref){const raw=await this.tx.get(doc(database(),ref.path));this.before.set(ref.path,raw.data()||null);return new Snapshot(raw);}
    // Browser transactions cannot query. Pin each result document to the transaction;
    // the shared guard makes adapter query membership changes conflict and retry.
    const results=await getDocsFromServer(ref.value);
    const docs=await Promise.all(results.docs.map(d=>this.get(new Ref(d.ref.path))));
    return {docs:docs.filter(d=>d.exists),size:docs.filter(d=>d.exists).length,empty:!docs.some(d=>d.exists)};
  }
  set(ref:Ref,value:DocumentData,options?:{merge:boolean}){this.writes++;this.record(ref,value,'set');if(ref.path.startsWith('adminActivity/'))value={...value,actorEmail:auth?.currentUser?.email||'',actorName:auth?.currentUser?.displayName||''};if(options?.merge)this.tx.set(doc(database(),ref.path),value,{merge:true});else this.tx.set(doc(database(),ref.path),value);}
  create(ref:Ref,value:DocumentData){this.set(ref,value);}
  update(ref:Ref,value:DocumentData){this.writes++;this.record(ref,value,'update');this.tx.update(doc(database(),ref.path),value);}
  delete(ref:Ref){this.writes++;this.record(ref,null,'delete');this.tx.delete(doc(database(),ref.path));}
}
export function getFirestore(){return {
  doc:(path:string)=>new Ref(path),collection:(path:string)=>new Collection(path),
  collectionGroup:(name:string)=>new Collection(name,collectionGroup(database(),name)),
  runTransaction:async<T>(handler:(tx:Transaction)=>Promise<T>):Promise<T>=>{
    const guard=doc(database(),'system/sparkGuard');
    for(let attempt=0;attempt<5;attempt++){
      let observed:number|undefined;
      try{return await runTransaction(database(),async native=>{
        const current=await native.get(guard);observed=current.data()?.revision||0;
        const tx=new Transaction(native);const result=await handler(tx);
        if(tx.writes){
          native.set(guard,{revision:observed!+1,updatedAt:serverTimestamp()});
          if(!tx.hasAudit&&tx.changes.length){let changes:unknown=tx.changes;const truncated=new TextEncoder().encode(JSON.stringify(changes)).length>150000;if(truncated)changes=tx.changes.map(({path,operation,fields})=>({path,operation,fields}));native.set(doc(collection(database(),'adminActivity')),{action:'order.'+(tx.activityAction||'updated'),actorUid:auth!.currentUser!.uid,actorEmail:auth!.currentUser!.email||'',actorName:auth!.currentUser!.displayName||'',changes,detailsTruncated:truncated,createdAt:serverTimestamp()});}
        }
        return result;
      });}catch(error){
        // Rules may reject an outdated revision before Firestore evaluates the
        // transaction precondition. Retry only with proof of a changed guard.
        if(attempt===4||observed===undefined||(error as {code?:string}).code!=='permission-denied')throw error;
        const latest=await getDocFromServer(guard);
        if((latest.data()?.revision||0)===observed)throw error;
      }
    }
    throw new Error('No se pudo guardar por cambios simultáneos. Vuelve a intentar.');
  },
};}
