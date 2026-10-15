import { brandingSchema } from '../../shared/branding';
import { getFirestore,onCall,FieldValue } from './store';
import { parse,requireAdmin,checkRevision } from './security';
export const saveBranding=onCall({},async request=>{
  if(!request.auth)throw new Error('Debes ingresar.');const value=parse(brandingSchema,request.data);
  await getFirestore().runTransaction(async tx=>{
    await requireAdmin(tx,request.auth!.uid);const ref=getFirestore().doc('branding/public');const current=await tx.get(ref);checkRevision(current.data(),value.revision);
    tx.set(ref,{...value,revision:value.revision+1,updatedAt:FieldValue.serverTimestamp()});
    tx.create(getFirestore().collection('adminActivity').doc(),{action:'branding',actorUid:request.auth!.uid,logoConfigured:Boolean(value.logoData),symbolConfigured:Boolean(value.symbolData),before:{headerWidth:current.data()?.headerWidth??180,logoConfigured:Boolean(current.data()?.logoData),symbolConfigured:Boolean(current.data()?.symbolData)},after:{headerWidth:value.headerWidth,logoConfigured:Boolean(value.logoData),symbolConfigured:Boolean(value.symbolData)},createdAt:FieldValue.serverTimestamp()});
  });return {status:'saved'};
});
