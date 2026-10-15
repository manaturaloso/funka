import {addDoc,collection,doc,serverTimestamp,runTransaction,getDocFromServer} from 'firebase/firestore';
import {auth,db} from './firebase';
export function personalActivity(action:string,fields:Record<string,unknown>={}){
 if(!db||!auth?.currentUser)throw Error('Debes ingresar.');
 return {ref:doc(collection(db,'adminActivity')),data:{...fields,action,actorUid:auth.currentUser.uid,actorEmail:auth.currentUser.email?.toLowerCase()||'',createdAt:serverTimestamp()}};
}
export async function recordAppAccess(){
 const e=personalActivity('access'),uid=auth!.currentUser!.uid;
 const ref=doc(db!,'adminActivity',`access-${uid}__${crypto.randomUUID()}`);
 try{await runTransaction(db!,async tx=>{const existing=await tx.get(ref);if(existing.exists()){if(existing.data().actorUid!==uid||existing.data().action!=='access')throw Error('Evento de ingreso ajeno.');return;}tx.set(ref,e.data);});}
 catch(error){
  // A committed write may be resent when auth/page lifecycle interrupts its acknowledgement.
  // Accept only this exact immutable event confirmed by the server, never ignore an auth error.
  if(!['already-exists','aborted','permission-denied'].includes((error as {code?:string}).code||''))throw error;
  const saved=await getDocFromServer(ref);if(!saved.exists()||saved.data().actorUid!==uid||saved.data().action!=='access')throw error;
 }
}
export async function recordExport(count:number){const e=personalActivity('exportPrepared',{count});await addDoc(collection(db!,'adminActivity'),e.data);}
