import {personalActivity} from './activity';
import { collection,doc,getDocs,runTransaction,serverTimestamp } from 'firebase/firestore';
import { auth,db } from './firebase';
import { savedViewSchema,type SavedView } from '../../shared/views';
function session(){if(!auth?.currentUser||!db)throw new Error('Debes ingresar.');return {uid:auth.currentUser.uid,db};}
export async function listViews(){const s=session();const result=await getDocs(collection(s.db,`users/${s.uid}/views`));return result.docs.map(d=>({id:d.id,...d.data()} as SavedView)).sort((a,b)=>a.name.localeCompare(b.name,'es'));}
export async function saveView(value:unknown,existing?:SavedView){
  const parsed=savedViewSchema.parse(value),s=session();
  if(!existing&&(await listViews()).length>=20)throw new Error('Puedes guardar hasta 20 vistas. Elimina una antes de crear otra.');
  const id=existing?.id||crypto.randomUUID(),ref=doc(s.db,`users/${s.uid}/views/${id}`),userRef=doc(s.db,'users',s.uid);
  await runTransaction(s.db,async tx=>{
    const user=await tx.get(userRef),current=await tx.get(ref);
    if(!user.data()?.active)throw new Error('Tu acceso no está activo.');
    if((current.data()?.revision||0)!==(existing?.revision||0))throw new Error('Esta vista cambió. Recarga las vistas antes de guardar.');
    tx.set(ref,{...parsed,revision:(existing?.revision||0)+1,createdAt:current.data()?.createdAt||serverTimestamp(),updatedAt:serverTimestamp()});
    tx.update(userRef,{preferencesRevision:(user.data()?.preferencesRevision||0)+1,preferencesUpdatedAt:serverTimestamp()});const event=personalActivity('viewSaved',{targetId:id});tx.set(event.ref,event.data);
  });return id;
}
export async function deleteView(view:SavedView){const s=session(),ref=doc(s.db,`users/${s.uid}/views/${view.id}`),userRef=doc(s.db,'users',s.uid);await runTransaction(s.db,async tx=>{const user=await tx.get(userRef),current=await tx.get(ref);if(!user.data()?.active)throw new Error('Tu acceso no está activo.');if(!current.exists())return;if(current.data().revision!==view.revision)throw new Error('Esta vista cambió. Recarga las vistas antes de eliminar.');tx.delete(ref);tx.update(userRef,{preferencesRevision:(user.data()?.preferencesRevision||0)+1,preferencesUpdatedAt:serverTimestamp()});const event=personalActivity('viewDeleted',{targetId:view.id});tx.set(event.ref,event.data);});}
