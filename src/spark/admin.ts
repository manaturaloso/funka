import {peoplePlan,applyPeople} from './people';
// Spark adapter. Derived from functions/src/admin.ts; enforce authorization in firestore.spark.rules.
import { getFirestore, FieldValue, Timestamp, FieldPath, type Transaction, type QuerySnapshot } from './store';
import { onCall, HttpsError } from './store';
import { sha256, randomUUID } from './store';
import { z } from 'zod';
import { scopeKey } from '../../shared/access';
import { orderTemplateSchema,memberSchema,invitationAdminSchema,entitySchema,settingsSchema,defaultSettings } from '../../shared/admin';
import { parse,requireAdmin,requireActive,checkRevision } from './security';
const db=()=>getFirestore();const options={region:'us-central1',maxInstances:5};
const emailKey=(email:string)=>sha256(email);
function audit(tx:Transaction,uid:string,action:string,before:unknown,after:unknown){tx.create(db().collection('adminActivity').doc(),{actorUid:uid,action,before,after,createdAt:FieldValue.serverTimestamp()});}
async function validateAccess(tx:Transaction,teamIds:string[],scopes:{teamId:string;brandId:string}[],allowArchived=false,retained?:{teams:Set<string>;scopes:Set<string>}){
  for(const id of new Set(teamIds)){const team=await tx.get(db().doc(`teams/${id}`));if(!team.exists||(!allowArchived&&team.data()!.archived&&!retained?.teams.has(id)))throw new HttpsError('failed-precondition','Uno de los equipos no está disponible.');}
  for(const scope of scopes){const link=await tx.get(db().doc(`teams/${scope.teamId}/brands/${scope.brandId}`));if(!link.exists||(!allowArchived&&link.data()!.archived&&!retained?.scopes.has(scopeKey(scope.teamId,scope.brandId))))throw new HttpsError('failed-precondition','Una combinación de equipo y marca no está disponible.');}
}
function writeAccess(tx:Transaction,uid:string,teamIds:string[],scopes:{teamId:string;brandId:string}[],oldAccess:QuerySnapshot,oldTeams:QuerySnapshot){
  const oldBrands=new Set(oldAccess.docs.map(d=>String(d.data().brandId)));
  const nextBrands=new Map(scopes.map(s=>[s.brandId,s]));
  for(const brand of oldBrands)if(!nextBrands.has(brand))tx.delete(db().doc(`users/${uid}/brandAccess/${brand}`));
  for(const [brand,scope] of nextBrands)tx.set(db().doc(`users/${uid}/brandAccess/${brand}`),scope);
  const selected=new Set(scopes.map(scope=>scopeKey(scope.teamId,scope.brandId)));
  for(const old of oldAccess.docs)if(!selected.has(old.id))tx.delete(old.ref);
  for(const scope of scopes)tx.set(db().doc(`users/${uid}/access/${scopeKey(scope.teamId,scope.brandId)}`),scope);
  for(const old of oldTeams.docs)if(!teamIds.includes(old.id))tx.delete(old.ref);
  for(const teamId of new Set(teamIds))tx.set(db().doc(`users/${uid}/memberships/${teamId}`),{teamId});
}
function encode(value:unknown):unknown {if(value instanceof Timestamp)return value.toDate().toISOString();if(Array.isArray(value))return value.map(encode);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,encode(item)]));return value;}
export const listAdmin=onCall(options,async request=>{
  if(!request.auth)throw new HttpsError('unauthenticated','Debes ingresar.');
  const value=parse(z.object({section:z.enum(['users','invitations','teams','brands','scopes','decks','orderTemplates','adminActivity']),cursor:z.string().regex(/^[a-zA-Z0-9_-]{1,512}$/).nullable().default(null)}).strict(),request.data);
  return db().runTransaction(async tx=>{await requireAdmin(tx,request.auth!.uid);let query=value.section==='adminActivity'?db().collection(value.section).orderBy('createdAt','desc').limit(101):db().collection(value.section).orderBy(FieldPath.documentId()).limit(101);if(value.cursor){if(value.section==='adminActivity'){const cursor=await tx.get(db().doc(`adminActivity/${value.cursor}`));if(!cursor.exists)throw new HttpsError('not-found','El punto de continuación no está disponible.');query=query.startAfter(cursor);}else query=query.startAfter(value.cursor);}const result=await tx.get(query);const records=[];for(const doc of result.docs.slice(0,100)){let actorName: string|undefined;if(value.section==='adminActivity'&&doc.data().actorUid){const actor=await tx.get(db().doc(`users/${doc.data().actorUid}`));actorName=doc.data().actorUid==='calendar-sync'?'Sincronización automática':actor.data()?.displayName||actor.data()?.email||doc.data().actorEmail||'Usuario no disponible';}records.push({id:doc.id,...encode(doc.data()) as object,...(actorName?{actorName}:{})});}return {records,nextCursor:result.size>100?result.docs[99].id:null};});
});
export const saveMember=onCall(options,async request=>{
  if(!request.auth)throw new HttpsError('unauthenticated','Debes ingresar.');const value=parse(memberSchema,request.data);
  await db().runTransaction(async tx=>{
    await requireAdmin(tx,request.auth!.uid);
    const ref=db().doc(`users/${value.uid}`);
    const [target,guard,admins,access,memberships]=await Promise.all([tx.get(ref),tx.get(db().doc('system/adminGuard')),tx.get(db().collection('users').where('active','==',true).where('role','==','superadmin')),tx.get(ref.collection('access')),tx.get(ref.collection('memberships'))]);
    if(!target.exists)throw new HttpsError('not-found','El usuario debe ingresar con Google antes de editar su cuenta.');if(value.role==='superadmin'&&target.data()!.email?.toLowerCase()!=='joel.yc23@gmail.com')throw new HttpsError('permission-denied','La administración general está reservada a joel.yc23@gmail.com.');checkRevision(target.data(),value.revision);
    const bootstrap=await tx.get(db().doc('system/bootstrap'));
    if(bootstrap.data()?.uid===value.uid&&(!value.active||value.role!=='superadmin'))throw new HttpsError('failed-precondition','El propietario inicial debe conservar su acceso de superadmin.');
    if(value.role==='superadmin'&&target.data()!.googleVerified!==true)throw new HttpsError('failed-precondition','La identidad Google debe verificarse con un ingreso antes de asignar superadmin.');
    if(target.data()!.role==='superadmin'&&target.data()!.active&&(value.role!=='superadmin'||!value.active)&&admins.size<=1)throw new HttpsError('failed-precondition','No puedes desactivar o degradar al último superadmin activo.');
    await validateAccess(tx,value.teamIds,value.scopes,!value.active,{teams:new Set([...memberships.docs.map(doc=>doc.id),...access.docs.map(doc=>doc.data().teamId)]),scopes:new Set(access.docs.map(doc=>doc.id))});
    const scopeIds=new Set(value.scopes.map(scope=>scopeKey(scope.teamId,scope.brandId)));const writes=access.docs.filter(doc=>!scopeIds.has(doc.id)).length+value.scopes.length+memberships.docs.filter(doc=>!value.teamIds.includes(doc.id)).length+new Set(value.teamIds).size+new Set(access.docs.map(d=>d.data().brandId)).size+new Set(value.scopes.map(s=>s.brandId)).size+3;if(writes>490)throw new HttpsError('resource-exhausted','Este usuario requiere una migración por lotes; no se cambió su acceso.');
    const directoryScopes=target.data()!.role==='superadmin'||value.role==='superadmin'?(await tx.get(db().collection('scopes'))).docs.map(d=>({teamId:String(d.data().teamId),brandId:String(d.data().brandId)})):[...access.docs.map(d=>({teamId:String(d.data().teamId),brandId:String(d.data().brandId)})),...value.scopes];
    const directory=await peoplePlan(tx,directoryScopes,{uid:value.uid,displayName:String(target.data()!.displayName||'Integrante'),eligible:s=>value.active&&(value.role==='superadmin'||scopeIds.has(scopeKey(s.teamId,s.brandId)))});if(writes+directory.length>490)throw new HttpsError('resource-exhausted','Los accesos y directorios superan el límite atómico.');applyPeople(tx,directory);
    writeAccess(tx,value.uid,value.teamIds,value.scopes,access,memberships);
    tx.update(ref,{active:value.active,role:value.role,teamIds:[...new Set(value.teamIds)],scopes:value.scopes,revision:value.revision+1,updatedAt:FieldValue.serverTimestamp()});
    tx.set(db().doc('system/adminGuard'),{revision:(guard.data()?.revision||0)+1,updatedAt:FieldValue.serverTimestamp()});
    audit(tx,request.auth!.uid,'memberAccess',{uid:value.uid,email:target.data()!.email,active:target.data()!.active,role:target.data()!.role,teamIds:target.data()!.teamIds||[],scopes:target.data()!.scopes||[]},value);
  });return {status:'saved'};
});
export const saveInvitation=onCall(options,async request=>{
  if(!request.auth)throw new HttpsError('unauthenticated','Debes ingresar.');const value=parse(invitationAdminSchema,request.data);
  await db().runTransaction(async tx=>{
    await requireAdmin(tx,request.auth!.uid);const ref=db().doc(`invitations/${await emailKey(value.email)}`);
    const [invitation,users]=await Promise.all([tx.get(ref),tx.get(db().collection('users').where('email','==',value.email))]);checkRevision(invitation.data(),value.revision);
    if(users.docs.some(user=>user.data().role!=='pending'))throw new HttpsError('failed-precondition','Este usuario ya tiene un perfil autorizado. Edita sus permisos en Usuarios.');
    if(users.size>1)throw new HttpsError('failed-precondition','Hay más de un UID con ese correo. Revisa los perfiles antes de autorizar.');
    await validateAccess(tx,value.teamIds,value.scopes,!value.active);
    const user=users.docs[0];let access:QuerySnapshot|undefined,memberships:QuerySnapshot|undefined;
    if(user){access=await tx.get(user.ref.collection('access'));memberships=await tx.get(user.ref.collection('memberships'));}
    const directory=user&&value.active?await peoplePlan(tx,value.scopes,{uid:user.id,displayName:String(user.data().displayName||'Integrante'),eligible:()=>true}):[];if(user&&directory.length+(access?.size||0)+value.scopes.length+(memberships?.size||0)+value.teamIds.length+new Set(access?.docs.map(d=>d.data().brandId)||[]).size+new Set(value.scopes.map(s=>s.brandId)).size+4>490)throw new HttpsError('resource-exhausted','Los accesos superan el límite atómico. Reduce la selección.');applyPeople(tx,directory);
    tx.set(ref,{...value,revision:value.revision+1,updatedBy:request.auth!.uid,updatedAt:FieldValue.serverTimestamp()});
    if(user&&value.active){writeAccess(tx,user.id,value.teamIds,value.scopes,access!,memberships!);tx.update(user.ref,{active:true,role:'member',teamIds:value.teamIds,scopes:value.scopes,revision:(user.data().revision||0)+1,updatedAt:FieldValue.serverTimestamp()});}
    audit(tx,request.auth!.uid,'invitation',invitation.exists?invitation.data():null,value);
  });return {status:'saved'};
});
export const saveEntity=onCall(options,async request=>{
  if(!request.auth)throw new HttpsError('unauthenticated','Debes ingresar.');const value=parse(entitySchema,request.data);
  await db().runTransaction(async tx=>{
    await requireAdmin(tx,request.auth!.uid);const memo=value.requestId?db().doc(`batchOperations/entity-${value.requestId}`):null;if(memo){const previous=await tx.get(memo);if(previous.exists){if(previous.data()!.actorUid!==request.auth!.uid||previous.data()!.signature!==JSON.stringify(value))throw new HttpsError('already-exists','La operación pertenece a otros cambios.');return;}}const ref=db().doc(`${value.kind}/${value.id}`);
    const [current,links]=await Promise.all([tx.get(ref),tx.get(db().collection('scopes').where(value.kind==='teams'?'teamId':'brandId','==',value.id))]);checkRevision(current.data(),value.revision);
    if(links.size>100)throw new HttpsError('resource-exhausted','Esta entidad requiere una migración por lotes. No se modificó ningún registro.');
    if(value.kind==='brands'&&value.automaticTeamId&&!value.archived){const [link,team]=await Promise.all([tx.get(db().doc(`teams/${value.automaticTeamId}/brands/${value.id}`)),tx.get(db().doc(`teams/${value.automaticTeamId}`))]);if(!link.exists||!team.exists||team.data()!.archived||(link.data()!.linkArchived??(link.data()!.archived&&!current.data()?.archived)))throw new HttpsError('failed-precondition','El equipo automático debe estar vinculado y activo para esta marca.');}
    const updates=[];
    for(const link of links.docs){const data=link.data();const [scope,other]=await Promise.all([tx.get(db().doc(`teams/${data.teamId}/brands/${data.brandId}`)),tx.get(db().doc(value.kind==='teams'?`brands/${data.brandId}`:`teams/${data.teamId}`))]);const linkArchived=scope.data()?.linkArchived??scope.data()?.archived??false;updates.push({link,scope,data:{[value.kind==='teams'?'teamName':'brandName']:value.name,linkArchived,archived:linkArchived||value.archived||Boolean(other.data()?.archived)}});}
    const change={name:value.name,archived:value.archived,revision:value.revision+1,updatedAt:FieldValue.serverTimestamp(),...(value.kind==='brands'?{channels:['WP','SIS'],automaticTeamId:value.automaticTeamId}:{})};
    tx.set(ref,change,{merge:true});for(const update of updates){tx.set(update.link.ref,update.data,{merge:true});tx.set(update.scope.ref,update.data,{merge:true});}
    if(memo)tx.create(memo,{actorUid:request.auth!.uid,signature:JSON.stringify(value),createdAt:FieldValue.serverTimestamp()});
    audit(tx,request.auth!.uid,'entity',{kind:value.kind,id:value.id,data:current.exists?current.data():null},value);
  });return {status:'saved'};
});
export const saveScope=onCall(options,async request=>{
  if(!request.auth)throw new HttpsError('unauthenticated','Debes ingresar.');const value=parse(z.object({teamId:z.string().regex(/^[a-zA-Z0-9-]{1,80}$/),brandId:z.string().regex(/^[a-zA-Z0-9-]{1,80}$/),revision:z.number().int().min(0),archived:z.boolean()}).strict(),request.data);
  await db().runTransaction(async tx=>{
    await requireAdmin(tx,request.auth!.uid);const ref=db().doc(`teams/${value.teamId}/brands/${value.brandId}`);
    const [link,team,brand]=await Promise.all([tx.get(ref),tx.get(db().doc(`teams/${value.teamId}`)),tx.get(db().doc(`brands/${value.brandId}`))]);checkRevision(link.data(),value.revision);
    if(!team.exists||!brand.exists)throw new HttpsError('failed-precondition','Crea el equipo y la marca antes de vincularlos.');
    if(!value.archived&&(team.data()!.archived||brand.data()!.archived))throw new HttpsError('failed-precondition','Recupera el equipo y la marca antes de activar la vinculación.');
    const data={teamId:value.teamId,brandId:value.brandId,teamName:team.data()!.name,brandName:brand.data()!.name,linkArchived:value.archived,archived:value.archived||Boolean(team.data()!.archived)||Boolean(brand.data()!.archived),revision:value.revision+1,updatedAt:FieldValue.serverTimestamp()};
    tx.set(ref,data,{merge:true});tx.set(db().doc(`scopes/${scopeKey(value.teamId,value.brandId)}`),data,{merge:true});
    audit(tx,request.auth!.uid,'scope',link.exists?link.data():null,data);
  });return {status:'saved'};
});
export const getSettings=onCall(options,async request=>{if(!request.auth)throw new HttpsError('unauthenticated','Debes ingresar.');return db().runTransaction(async tx=>{await requireActive(tx,request.auth!.uid);const settings=await tx.get(db().doc('settings/general'));const data=settings.data()||{};return {requestTypes:data.requestTypes||defaultSettings.requestTypes,deliveryHour:data.deliveryHour||defaultSettings.deliveryHour,syncHour:data.syncHour||defaultSettings.syncHour,autoDeadlineDays:data.autoDeadlineDays||defaultSettings.autoDeadlineDays,display:data.display||defaultSettings.display,requiredFields:data.requiredFields||[],timeZone:'America/Lima',revision:data.revision||0};});});
export const saveSettings=onCall(options,async request=>{
  if(!request.auth)throw new HttpsError('unauthenticated','Debes ingresar.');const value=parse(z.object({revision:z.number().int().min(0),settings:settingsSchema}).strict(),request.data);
  await db().runTransaction(async tx=>{await requireAdmin(tx,request.auth!.uid);const ref=db().doc('settings/general');const current=await tx.get(ref);checkRevision(current.data(),value.revision);tx.set(ref,{...value.settings,timeZone:'America/Lima',revision:value.revision+1,updatedAt:FieldValue.serverTimestamp()});audit(tx,request.auth!.uid,'settings',current.exists?current.data():defaultSettings,value.settings);});return {status:'saved'};
});

export const saveOrderTemplate=onCall(options,async request=>{
  if(!request.auth)throw new HttpsError('unauthenticated','Debes ingresar.');const value=parse(orderTemplateSchema,request.data);
  await db().runTransaction(async tx=>{await requireAdmin(tx,request.auth!.uid);const ref=db().doc(`orderTemplates/${value.id}`);const [current,settings]=await Promise.all([tx.get(ref),tx.get(db().doc('settings/general'))]);checkRevision(current.data(),value.revision);if(!value.archived&&!(settings.data()?.requestTypes||defaultSettings.requestTypes).includes(value.type))throw new HttpsError('invalid-argument','Selecciona un tipo activo de pedido.');const change={...value,revision:value.revision+1,updatedAt:FieldValue.serverTimestamp()};tx.set(ref,change);tx.create(ref.collection('versions').doc(String(change.revision)),change);audit(tx,request.auth!.uid,'orderTemplate',current.exists?current.data():null,value);});return {status:'saved'};
});
export const listOrderTemplates=onCall(options,async request=>{if(!request.auth)throw new HttpsError('unauthenticated','Debes ingresar.');return db().runTransaction(async tx=>{await requireActive(tx,request.auth!.uid);const templates=await tx.get(db().collection('orderTemplates').where('archived','==',false));return templates.docs.map(doc=>({id:doc.id,...encode(doc.data()) as object}));});});
