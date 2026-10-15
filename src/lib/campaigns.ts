import {calendarOrderChange} from '../../shared/calendar-sync.mts';
import {defaultSettings} from '../../shared/admin';
import {collection,doc,runTransaction,serverTimestamp} from 'firebase/firestore';
import {z} from 'zod';
import {auth,db} from './firebase';
const day=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>{const d=new Date(v+'T12:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===v;},'Usa una fecha válida.');
export const campaignReviewSchema=z.object({title:z.string().trim().min(1).max(2000),start:day,end:day,channels:z.array(z.enum(['WP','SIS'])).max(2).refine(v=>new Set(v).size===v.length),teamId:z.string().nullable(),brandId:z.string().nullable(),reviewed:z.boolean()}).strict().superRefine((v,c)=>{if(v.end<v.start)c.addIssue({code:'custom',message:'El fin debe ser posterior o igual al inicio.'});if(Boolean(v.teamId)!==Boolean(v.brandId))c.addIssue({code:'custom',message:'Selecciona una combinación de equipo y marca.'});if(v.reviewed&&(!v.channels.length||!v.teamId||!v.brandId))c.addIssue({code:'custom',message:'Define equipo, marca y canal antes de completar la revisión.'});});
export type CampaignReview=z.infer<typeof campaignReviewSchema>;
export interface CampaignDraft extends CampaignReview{id:string;revision:number;sourceMissing?:boolean;syncStatus?:string;sourceLatest?:{title:string;start:string;end:string;sheet:string;range:string};sourceSha256:string;source:{sheet:string;range:string;title:string;start:string;end:string;issues:string[]}}
export async function saveCampaignReview(id:string,revision:number,input:CampaignReview){
 if(!db||!auth?.currentUser)throw Error('Debes ingresar con acceso de administrador.');
 const parsed=campaignReviewSchema.safeParse(input);if(!parsed.success)throw Error(parsed.error.issues.map(i=>i.message).join(' '));const data=parsed.data,uid=auth.currentUser.uid;
 await runTransaction(db,async tx=>{
  const ref=doc(db!,'campaignDrafts',id),old=await tx.get(ref),guard=await tx.get(doc(db!,'system/sparkGuard')),settings=await tx.get(doc(db!,'settings/general'));
  if(!old.exists()||old.data().revision!==revision)throw Error('Otra persona cambió esta campaña. Cierra la edición y vuelve a abrirla; tus cambios no se publicaron.');
  if(data.teamId&&data.brandId){const scope=await tx.get(doc(db!,`teams/${data.teamId}/brands/${data.brandId}`));if(!scope.exists()||scope.data().archived)throw Error('La combinación de equipo y marca ya no está disponible.');}
  const updates: {ref:ReturnType<typeof doc>;fields:Record<string,unknown>;before:unknown;after:unknown;channel:string}[]=[];
  if(data.reviewed&&!old.data().sourceMissing)for(const channel of data.channels){
   const marker=await tx.get(doc(db!,`campaignDrafts/${id}/orders/${channel}`));if(!marker.exists()||marker.data().mode!=='created')continue;
   const target=doc(db!,`teams/${marker.data().teamId}/brands/${marker.data().brandId}/orders/${marker.data().orderId}`),order=await tx.get(target);if(!order.exists())continue;
   const change=calendarOrderChange({id,revision:revision+1,...data},marker.data(),order.data(),{...defaultSettings,...settings.data()});if(change.fields)updates.push({ref:target,fields:change.fields,before:change.before,after:change.after,channel});
  }
  const syncStatus=data.reviewed?'reviewed':old.data().syncStatus||'new';tx.update(ref,{...data,syncStatus,syncConflicts:[],revision:revision+1,updatedAt:serverTimestamp()});
  const operationId=crypto.randomUUID();for(const update of updates){tx.update(update.ref,{...update.fields,updatedAt:serverTimestamp()});tx.set(doc(collection(update.ref,'activity'),operationId),{action:'calendarDeadline',revision:update.fields.revision,actorUid:uid,before:update.before,after:update.after,createdAt:serverTimestamp()});tx.set(doc(collection(db!,'adminActivity')),{action:'calendarDeadline',campaignId:id,teamId:data.teamId,brandId:data.brandId,orderId:update.ref.id,actorUid:uid,before:update.before,after:update.after,createdAt:serverTimestamp()});}
  tx.set(doc(db!,'system/sparkGuard'),{revision:(guard.data()?.revision||0)+1,updatedAt:serverTimestamp()});
  tx.set(doc(collection(db!,'adminActivity')),{action:'Revisión de campaña',campaignId:id,before:Object.fromEntries(Object.keys(data).map(k=>[k,old.data()[k]??null])),after:{...data,syncStatus,syncConflicts:[]},actorEmail:auth!.currentUser!.email||'',actorName:auth!.currentUser!.displayName||'',actorUid:uid,createdAt:serverTimestamp()});
 });
}
