import { doc, getDoc, collection, getDocsFromServer, runTransaction, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { scopeSchema,SUPERADMIN_EMAIL,isGeneralAdmin } from '../../shared/access';
import * as orders from './orders';
import * as campaigns from './campaign-generation';
import * as admin from './admin';
import * as decks from './decks';
import * as recurrences from './recurrences';
import * as productivity from './productivity';
import * as deletion from './deletion';
import {claimInvitation} from './invitations';
import { saveBranding } from './branding';

export async function establishAccess(){
  const user=auth?.currentUser;if(!user||!db)throw new Error('Debes ingresar.');
  const identity=await user.getIdTokenResult();
  if(identity.signInProvider!=='google.com'||!user.emailVerified)throw new Error('Ingresa con una cuenta Google verificada.');
  const ref=doc(db,'users',user.uid);
  if(await claimInvitation())return;
  await runTransaction(db,async tx=>{
    const profile=await tx.get(ref);if(profile.exists())return;
    const bootstrapRef=doc(db!,'system/bootstrap');const bootstrap=await tx.get(bootstrapRef);
    const owner=user.email===SUPERADMIN_EMAIL&&(!bootstrap.exists()||bootstrap.data().uid===user.uid);
    if(owner&&!bootstrap.exists())tx.set(bootstrapRef,{uid:user.uid,email:SUPERADMIN_EMAIL,createdAt:serverTimestamp()});
    tx.set(ref,{uid:user.uid,email:user.email,displayName:user.displayName||user.email||'Integrante',googleVerified:true,authProvider:'google.com',active:owner,role:owner?'superadmin':'pending',scopes:[],teamIds:[],revision:1,createdAt:serverTimestamp()});
  });
}
const handlers:Record<string,(data:never)=>Promise<unknown>>={...orders,...campaigns,...admin,...decks,...deletion,...productivity,saveRecurrence:recurrences.saveRecurrence,runRecurrence:recurrences.runRecurrence,saveBranding,establishAccess} as unknown as Record<string,(data:never)=>Promise<unknown>>;
const collaborative=new Set(['createOrder','mutateOrder']);
const reads=new Set(['listScopes','listMembers','getSettings','listOrderTemplates','listBrandDecks','listScopedOrders']);
export async function sparkCall<T>(name:string,data:unknown):Promise<T>{
  if(name==='establishAccess'){await establishAccess();return undefined as T;}
  if(!auth?.currentUser||!db)throw new Error('Debes ingresar.');
  const profile=await getDoc(doc(db,'users',auth.currentUser.uid));
  if(!profile.data()?.active)throw new Error('Tu acceso no está activo.');
  if(!reads.has(name)&&!collaborative.has(name)&&!isGeneralAdmin(profile.data()))throw new Error('Esta operación está reservada a la administración general.');
  // Use only the scoped directory; other users' private profiles stay private.
  if(name==='listMembers'&&!isGeneralAdmin(profile.data())){const s=scopeSchema.parse(data),rows=await getDocsFromServer(collection(db,`teams/${s.teamId}/brands/${s.brandId}/people`));const names=new Map(rows.docs.map(d=>[d.id,{uid:d.id,email:'',displayName:String(d.data().displayName)}]));names.set(profile.id,{uid:profile.id,email:String(profile.data()?.email),displayName:String(profile.data()?.displayName)});return [...names.values()] as T;}
  const handler=handlers[name];if(!handler)throw new Error('Operación no disponible.');
  return await handler(data as never) as T;
}
