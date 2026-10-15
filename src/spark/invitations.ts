import {doc,collection,query,where,limit,getDocFromServer,getDocsFromServer,runTransaction,serverTimestamp,arrayUnion} from 'firebase/firestore';
import {auth,db} from '../lib/firebase';
import {scopeKey,type Profile} from '../../shared/access';
import {invitationAdminSchema} from '../../shared/admin';
import {sha256} from './store';
// Redeem only the administrator's current invitation for this verified identity.
export async function claimInvitation():Promise<boolean>{
 const user=auth?.currentUser;if(!db||!user?.email)return false;
 const email=user.email.toLowerCase(),invitationId=await sha256(email),database=db;
 const existing=await getDocFromServer(doc(database,'users',user.uid));
 if(existing.exists()&&existing.data().role!=='pending')return true;
 const own=await getDocsFromServer(query(collection(database,'invitations'),where('email','==',email),limit(2)));
 if(!own.docs.some(d=>d.id===invitationId&&d.data().active===true))return false;
 return runTransaction(database,async tx=>{
  const profileRef=doc(database,'users',user.uid),profile=await tx.get(profileRef);
  if(profile.exists()&&profile.data().role!=='pending')return true;
  const invitation=await tx.get(doc(database,'invitations',invitationId));
  if(!invitation.exists()||!invitation.data().active)return false;
  const data=invitation.data(),value=invitationAdminSchema.parse({email:data.email,active:data.active,revision:data.revision,teamIds:data.teamIds||[],scopes:data.scopes||[]});
  if(value.email!==email)throw Error('La invitación no corresponde a tu correo.');
  const guardRef=doc(database,'system/sparkGuard'),guard=await tx.get(guardRef);
  const current=profile.data() as Profile|undefined;
  const next={...(current||{}),uid:user.uid,email,displayName:current?.displayName||user.displayName||email,googleVerified:true,authProvider:'google.com',active:true,role:'member',scopes:value.scopes,teamIds:value.teamIds,revision:(current?.revision||0)+1,invitationId,invitationRevision:value.revision,updatedAt:serverTimestamp(),...(!profile.exists()?{createdAt:serverTimestamp()}:{})};
  tx.set(profileRef,next);
  for(const teamId of value.teamIds)tx.set(doc(database,`users/${user.uid}/memberships/${teamId}`),{teamId});
  for(const scope of value.scopes){
   tx.set(doc(database,`teams/${scope.teamId}/brands/${scope.brandId}/collaboration/directory`),{uids:arrayUnion(user.uid)},{merge:true});
   tx.set(doc(database,`users/${user.uid}/brandAccess/${scope.brandId}`),scope);
   tx.set(doc(database,`users/${user.uid}/access/${scopeKey(scope.teamId,scope.brandId)}`),scope);
   tx.set(doc(database,`teams/${scope.teamId}/brands/${scope.brandId}/people/${user.uid}`),{uid:user.uid,displayName:next.displayName});
  }
  tx.set(guardRef,{revision:(guard.data()?.revision||0)+1,updatedAt:serverTimestamp()});
  tx.set(doc(database,`adminActivity/invitation-claim-${user.uid}`),{action:'invitationClaim',actorUid:user.uid,actorEmail:email,invitationId,invitationRevision:value.revision,createdAt:serverTimestamp()});
  return true;
 }).catch(async error=>{
   // Two tabs or auth callbacks can finish the same first registration together.
   // Only accept an independently committed server profile, never retry a grant blindly.
   if(['already-exists','aborted','permission-denied'].includes(error?.code)){
     const established=await getDocFromServer(doc(database,'users',user.uid));
     if(established.exists()&&established.data().role!=='pending')return true;
   }
   throw error;
 });
}
