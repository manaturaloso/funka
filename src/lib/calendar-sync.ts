import {doc,collection,runTransaction,serverTimestamp} from 'firebase/firestore';
import {db,auth} from './firebase';
export const calendarSourceId='1SaoG7PHCmVmKB7llxu2OFbYSVT6m25kWfNAU5I27hiQ';
export async function requestCalendarSync(){
 if(!db||!auth?.currentUser)throw Error('Debes ingresar.');
 await runTransaction(db,async tx=>{const config=await tx.get(doc(db!,'calendarSync/config'));if(!config.data()?.automationReady)throw Error('La ejecución diaria todavía no está configurada.');const guard=await tx.get(doc(db!,'system/sparkGuard'));const old=await tx.get(doc(db!,'calendarSync/request'));const id=crypto.randomUUID();tx.set(doc(db!,'calendarSync/request'),{id,revision:(old.data()?.revision||0)+1,actorUid:auth!.currentUser!.uid,requestedAt:serverTimestamp()});tx.set(doc(db!,'system/sparkGuard'),{revision:(guard.data()?.revision||0)+1,updatedAt:serverTimestamp()});tx.set(doc(collection(db!,'adminActivity')),{action:'calendarSyncRequested',actorUid:auth!.currentUser!.uid,actorEmail:auth!.currentUser!.email||'',createdAt:serverTimestamp(),requestId:id});});
}
export async function resolveCalendarIdentity(id:string,revision:number,campaignId:string|null){
 if(!db||!auth?.currentUser)throw Error('Debes ingresar.');
 await runTransaction(db,async tx=>{const ref=doc(db!,'calendarChanges',id),old=await tx.get(ref),guard=await tx.get(doc(db!,'system/sparkGuard')),request=await tx.get(doc(db!,'calendarSync/request'));if(!old.exists()||old.data().revision!==revision||old.data().status!=='pending')throw Error('La coincidencia cambió. Actualiza la vista.');if(campaignId&&!old.data().candidates.includes(campaignId))throw Error('Selecciona una de las campañas indicadas.');tx.set(doc(db!,'calendarSync/request'),{id:crypto.randomUUID(),revision:(request.data()?.revision||0)+1,actorUid:auth!.currentUser!.uid,requestedAt:serverTimestamp()});tx.update(ref,{decision:campaignId,status:'decided',revision:revision+1,decidedBy:auth!.currentUser!.uid,decidedAt:serverTimestamp()});tx.set(doc(db!,'system/sparkGuard'),{revision:(guard.data()?.revision||0)+1,updatedAt:serverTimestamp()});tx.set(doc(collection(db!,'adminActivity')),{action:'calendarIdentityResolved',actorUid:auth!.currentUser!.uid,createdAt:serverTimestamp(),changeId:id,before:{status:'pending'},after:{campaignId}});});
}

export async function setCalendarEnabled(enabled:boolean){
 if(!db||!auth?.currentUser)throw Error('Debes ingresar.');
 await runTransaction(db,async tx=>{const ref=doc(db!,'calendarSync/config'),old=await tx.get(ref),guard=await tx.get(doc(db!,'system/sparkGuard'));if(!old.data()?.automationReady)throw Error('La ejecución diaria todavía no está configurada.');tx.update(ref,{enabled,revision:(old.data()?.revision||0)+1,updatedAt:serverTimestamp()});tx.set(doc(db!,'system/sparkGuard'),{revision:(guard.data()?.revision||0)+1,updatedAt:serverTimestamp()});tx.set(doc(collection(db!,'adminActivity')),{action:'calendarScheduleChanged',actorUid:auth!.currentUser!.uid,before:{enabled:old.data()?.enabled},after:{enabled},createdAt:serverTimestamp()});});
}
