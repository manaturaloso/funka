import {collaborativeReceipt} from './order-receipts';
import {requireAdmin as requireGeneralAdmin} from './security';
import {dependencyCycle} from '../../shared/dependencies';
// Spark adapter. Derived from functions/src/orders.ts; enforce authorization in firestore.spark.rules.
import { getFirestore, FieldValue, Timestamp, FieldPath, type Transaction, type QuerySnapshot } from './store';
import { onCall, HttpsError } from './store';
import { z } from 'zod';
import { sha256, randomUUID } from './store';
import { isGeneralAdmin,scopeKey, scopeSchema } from '../../shared/access';
import { defaultDeck,copyDeck } from './decks';
import { deckSnapshot,defaultSettings,missingRequired } from '../../shared/admin';
import { createOrderSchema, mutationSchema, assignedUids, readyForDelivery, type Order } from '../../shared/orders';
const options = {region:'us-central1',maxInstances:5};
const db = () => getFirestore();
function parse<T>(schema:z.ZodType<T>, value:unknown):T {const parsed=schema.safeParse(value);if(!parsed.success) throw new HttpsError('invalid-argument',parsed.error.issues.map(v=>v.message).join(' '));return parsed.data;}
async function actor(tx:Transaction, uid:string, scope?:{teamId:string;brandId:string}) {
  const user = await tx.get(db().doc(`users/${uid}`));
  if (!user.exists || user.data()!.active !== true || user.data()!.role === 'pending') throw new HttpsError('permission-denied','Tu cuenta no tiene acceso activo.');
  if (scope) {
    const [access, brand] = await Promise.all([tx.get(db().doc(`users/${uid}/access/${scopeKey(scope.teamId,scope.brandId)}`)),tx.get(db().doc(`teams/${scope.teamId}/brands/${scope.brandId}`))]);
    if ((!isGeneralAdmin(user.data()) && !access.exists) || !brand.exists || brand.data()!.archived === true) throw new HttpsError('permission-denied','No tienes acceso a esta combinación de equipo y marca.');
  }
  return user.data()!;
}
async function assignees(tx:Transaction,uids:string[],scope:{teamId:string;brandId:string}) {
  for (const uid of new Set(uids)) {
    const [person,directory]=await Promise.all([tx.get(db().doc(`teams/${scope.teamId}/brands/${scope.brandId}/people/${uid}`)),tx.get(db().doc(`teams/${scope.teamId}/brands/${scope.brandId}/collaboration/directory`))]);
    if (!person.exists||!directory.data()?.uids?.includes(uid)) throw new HttpsError('permission-denied','Solo puedes asignar personas autorizadas para esta marca y equipo.');
  }
}
export const listScopes = onCall(options,async request => {
  if (!request.auth) throw new HttpsError('unauthenticated','Debes ingresar.');
  return db().runTransaction(async tx=> {
    const user=await actor(tx,request.auth!.uid);
    const grants=isGeneralAdmin(user) ? await tx.get(db().collection('scopes')) : await tx.get(db().collection(`users/${request.auth!.uid}/access`));
    const result=[];
    for (const grant of grants.docs) {
      const scope = scopeSchema.safeParse(grant.data());if(!scope.success) continue;
      const brand=await tx.get(db().doc(`teams/${scope.data.teamId}/brands/${scope.data.brandId}`));
      if (brand.exists && !brand.data()!.archived) result.push({...scope.data,teamName:brand.data()!.teamName,brandName:brand.data()!.brandName});
    }
    return result;
  });
});
export const createScope = onCall(options,async request => {
  if (!request.auth) throw new HttpsError('unauthenticated','Debes ingresar.');
  const value=parse(scopeSchema.extend({teamName:z.string().trim().min(1).max(100),brandName:z.string().trim().min(1).max(100)}).strict(),request.data);
  const created=await db().runTransaction(async tx=> {
    const user=await actor(tx,request.auth!.uid);
    await requireGeneralAdmin(tx,request.auth!.uid);
    const ref=db().doc(`teams/${value.teamId}/brands/${value.brandId}`);
    const [existing,team,brand]=await Promise.all([tx.get(ref),tx.get(db().doc(`teams/${value.teamId}`)),tx.get(db().doc(`brands/${value.brandId}`))]);
    if(team.exists&&(team.data()!.name!==value.teamName||team.data()!.archived))throw new HttpsError('failed-precondition','El ID del equipo ya está asociado a otro nombre o está archivado.');
    if(brand.exists&&(brand.data()!.name!==value.brandName||brand.data()!.archived))throw new HttpsError('failed-precondition','El ID de marca ya está asociado a otro nombre o está archivado.');
    if(existing.exists){if(existing.data()!.archived||existing.data()!.teamName!==value.teamName||existing.data()!.brandName!==value.brandName)throw new HttpsError('already-exists','Esta combinación ya existe con otra configuración.');return false;}
    const admins=await tx.get(db().collection('users').where('active','==',true).where('role','==','superadmin').limit(101));if(admins.size>100)throw new HttpsError('resource-exhausted','Demasiados administradores para configurar el directorio.');
    tx.set(ref.collection('collaboration').doc('directory'),{uids:admins.docs.filter(d=>isGeneralAdmin(d.data())).map(d=>d.id)});
    for(const person of admins.docs)tx.set(ref.collection('people').doc(person.id),{uid:person.id,displayName:String(person.data().displayName||'Integrante')});
    if(!team.exists)tx.create(db().doc(`teams/${value.teamId}`),{name:value.teamName,archived:false,createdAt:FieldValue.serverTimestamp()});
    if(!brand.exists)tx.create(db().doc(`brands/${value.brandId}`),{name:value.brandName,channels:['WP','SIS'],archived:false,createdAt:FieldValue.serverTimestamp()});
    tx.create(ref,{...value,archived:false,createdAt:FieldValue.serverTimestamp()});
    tx.set(db().doc(`scopes/${scopeKey(value.teamId,value.brandId)}`),value);
    tx.set(db().doc(`users/${request.auth!.uid}/access/${scopeKey(value.teamId,value.brandId)}`),value);
    tx.create(db().collection('adminActivity').doc(),{action:'createScope',actorUid:request.auth!.uid,...value,createdAt:FieldValue.serverTimestamp()});
    return true;
  });return {status:created?'created':'existing'};
});
export const listMembers = onCall(options,async request=> {
  if(!request.auth) throw new HttpsError('unauthenticated','Debes ingresar.');
  const scope=parse(scopeSchema,request.data);
  return db().runTransaction(async tx=>{
    await actor(tx,request.auth!.uid,scope);
    const grants=await tx.get(db().collectionGroup('access').where('teamId','==',scope.teamId).where('brandId','==',scope.brandId));
    const results=[];
    for(const grant of grants.docs){
      const parent=grant.ref.parent.parent;if(!parent || parent.parent.id!=='users') continue;
      const user=await tx.get(parent);if(user.data()?.active) results.push({uid:parent.id,displayName:user.data()!.displayName,email:user.data()!.email});
    }
    const admins=await tx.get(db().collection('users').where('active','==',true).where('role','==','superadmin'));
    for(const admin of admins.docs)if(isGeneralAdmin(admin.data())&&!results.some(member=>member.uid===admin.id))results.push({uid:admin.id,displayName:admin.data().displayName,email:admin.data().email});
    return results;
  });
});
export const createOrder = onCall(options,async request=>{
  if(!request.auth) throw new HttpsError('unauthenticated','Debes ingresar.');
  const value=parse(createOrderSchema,request.data);
  const ref=db().doc(`teams/${value.teamId}/brands/${value.brandId}/orders/${value.requestId}`);
  await db().runTransaction(async tx=>{
    const editor=await actor(tx,request.auth!.uid,value);
    const existing=await tx.get(ref);
    if(existing.exists){if(existing.data()!.createdBy !== request.auth!.uid) throw new HttpsError('already-exists','ID de pedido existente.');return;}
    const order:Order={id:ref.id,teamId:value.teamId,brandId:value.brandId,title:value.title,description:'',type:'Otro',channel:null,priority:'Media',assigneeUid:null,collaborators:[],deadline:null,status:'Por asignar',pieces:[],assignedUids:[],createdBy:request.auth!.uid,revision:1,archived:false,deadlineMode:'manual',review:'Pendiente',deliveryUrl:null,deckWarning:false,block:null};
    const settings=await tx.get(db().doc('settings/general'));order.type=(settings.data()?.requestTypes||defaultSettings.requestTypes).includes('Otro')?'Otro':(settings.data()?.requestTypes||defaultSettings.requestTypes)[0];
    order.channel=value.channel;
    if(value.templateId){const template=await tx.get(db().doc(`orderTemplates/${value.templateId}`));if(!template.exists||template.data()!.archived)throw new HttpsError('failed-precondition','La plantilla ya no está disponible.');if(!(settings.data()?.requestTypes||defaultSettings.requestTypes).includes(template.data()!.type))throw new HttpsError('failed-precondition','La plantilla usa un tipo que ya no está activo.');order.description=template.data()!.description;order.type=template.data()!.type;order.priority=template.data()!.priority;order.channel=value.channel||template.data()!.channel;order.orderTemplate={id:template.id,revision:template.data()!.revision,name:template.data()!.name};}
    
    if(value.type){if(!(settings.data()?.requestTypes||defaultSettings.requestTypes).includes(value.type))throw new HttpsError('invalid-argument','El tipo de pedido no está activo en el catálogo.');order.type=value.type;}
    if(value.priority)order.priority=value.priority;
    for(const field of ['campaignName','estimatedMinutes','assignedOn','socialNetwork','postingDate','detailImages'] as const){if(value[field]!==undefined)Object.assign(order,{[field]:value[field]});}
    order.description=value.description||order.description;order.assigneeUid=value.assigneeUid;order.collaborators=[...new Set(value.collaborators)].filter(uid=>uid!==value.assigneeUid);order.deadline=value.deadline;order.assignedUids=assignedUids(order);if(order.assigneeUid)order.status='Pendiente';if(value.status)order.status=value.status==='Pendiente'&&!order.assigneeUid?'Por asignar':value.status;order.deliveryUrl=value.deliveryUrl||null;order.assignedOn=value.assignedOn??new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Lima'}).format(new Date());
    await assignees(tx,order.assignedUids,value);
    const missing=missingRequired(order,(settings.data()?.requiredFields||[]).filter((f:string)=>f!=='description'));if(missing.length)throw new HttpsError('invalid-argument',`Completa los campos obligatorios: ${missing.join(', ')}.`);
    if(order.channel){const deck=await defaultDeck(tx,value.brandId,order.channel);if(deck){order.pieces=copyDeck(deck);order.deck=deckSnapshot(deck);}else order.deckWarning=true;}
    if(order.status==='Entregado'){const error=readyForDelivery(order);if(error)throw new HttpsError('failed-precondition',error);}
    if(new TextEncoder().encode(JSON.stringify(order)).length>700000)throw new HttpsError('resource-exhausted','El pedido tiene demasiadas imágenes o especificaciones.');
    if(!isGeneralAdmin(editor)){Object.assign(order,{lastOperationId:value.requestId});collaborativeReceipt(tx,ref,null,order,value.requestId,'created');}
    tx.create(ref,{...order,...(order.status==='Entregado'?{deliveredAt:FieldValue.serverTimestamp()}:{}),createdAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()});
    if(order.deliveryUrl)tx.create(ref.collection('deliveries').doc(value.requestId),{url:order.deliveryUrl,pieceId:null,actorUid:request.auth!.uid,createdAt:FieldValue.serverTimestamp()});
    tx.create(ref.collection('activity').doc(value.requestId),{action:'created',revision:1,actorUid:request.auth!.uid,createdAt:FieldValue.serverTimestamp()});
  });return {id:ref.id};
});
export const mutateOrder = onCall(options,async request=>{
  if(!request.auth) throw new HttpsError('unauthenticated','Debes ingresar.');
  const value=parse(mutationSchema,request.data);
  const ref=db().doc(`teams/${value.teamId}/brands/${value.brandId}/orders/${value.orderId}`);
  await db().runTransaction(async tx=>{
    const editor=await actor(tx,request.auth!.uid,value);
    const [snapshot,operation]=await Promise.all([tx.get(ref),tx.get(ref.collection('activity').doc(value.operationId))]);
    if(operation.exists){if(operation.data()!.actorUid!==request.auth!.uid) throw new HttpsError('permission-denied','Operación ajena.');return;}
    if(!snapshot.exists) throw new HttpsError('not-found','No existe el pedido.');
    const current=snapshot.data() as Order;
    if(current.revision!==value.revision) throw new HttpsError('aborted','Otra persona modificó el pedido. Revisa los datos actualizados y vuelve a guardar.');
    const next:Order={...current,pieces:current.pieces.map(p=>({...p}))};
    const action=value.action;let dependencyUpdate:{nodes:Record<string,string[]>;revision:number}|undefined;
    const dependencyRef=db().doc(`teams/${value.teamId}/brands/${value.brandId}/dependencies/graph`);
    if(current.archived && action.kind!=='archive') throw new HttpsError('failed-precondition','Recupera el pedido antes de editarlo.');
    if(action.kind==='edit') {
      const configuration=await tx.get(db().doc('settings/general'));const missing=missingRequired(action.fields,(configuration.data()?.requiredFields||[]).filter((f:string)=>f!=='description'));if(missing.length)throw new HttpsError('invalid-argument',`Completa los campos obligatorios: ${missing.join(', ')}.`);
      await assignees(tx,[action.fields.assigneeUid,...action.fields.collaborators].filter((x):x is string=>Boolean(x)),value);
      if(action.fields.type!==current.type){const settings=await tx.get(db().doc('settings/general'));if(!(settings.data()?.requestTypes||defaultSettings.requestTypes).includes(action.fields.type))throw new HttpsError('invalid-argument','El tipo de pedido no está activo en el catálogo.');}
      Object.assign(next,action.fields);
      if(next.channel&&next.channel!==current.channel&&!current.pieces.length&&!current.deck){const deck=await defaultDeck(tx,value.brandId,next.channel);if(deck){next.pieces=copyDeck(deck);next.deck=deckSnapshot(deck);}}
      if(current.deadline!==next.deadline) next.deadlineMode='manual';
      next.deckWarning=Boolean(next.channel&&(!next.deck||next.deck.channel!==next.channel));
    }
    if(action.kind==='dependencies'){const graph=await tx.get(dependencyRef),nodes={...(graph.data()?.nodes||{}),[value.orderId]:action.orderIds} as Record<string,string[]>;if(Object.keys(nodes).length>500)throw new HttpsError('resource-exhausted','Este equipo y marca supera 500 nodos de dependencias.');if(dependencyCycle(nodes))throw new HttpsError('failed-precondition','La selección crea un ciclo de dependencias.');for(const id of action.orderIds){const parent=await tx.get(db().doc(`teams/${value.teamId}/brands/${value.brandId}/orders/${id}`));if(!parent.exists)throw new HttpsError('not-found','Una dependencia ya no existe.');}next.dependencies=action.orderIds;dependencyUpdate={nodes,revision:(graph.data()?.revision||0)+1};}
    if(action.kind==='deliver'||(action.kind==='status'&&['En proceso','En revisión','Por validar','Por subir'].includes(action.status))){for(const id of current.dependencies||[]){const parent=await tx.get(db().doc(`teams/${value.teamId}/brands/${value.brandId}/orders/${id}`));if(!parent.exists||parent.data()!.status!=='Entregado')throw new HttpsError('failed-precondition','Antes debes entregar las dependencias de este pedido.');}}
    if(action.kind==='piece') {
      if(action.piece.assigneeUid) await assignees(tx,[action.piece.assigneeUid],value);
      const previous=next.pieces.find(p=>p.id===action.piece.id);
      if(JSON.stringify(previous?.source)!==JSON.stringify(action.piece.source)||Boolean(previous?.retired)!==Boolean(action.piece.retired))throw new HttpsError('invalid-argument','El origen de una plantilla solo puede cambiarse al aplicar un deck con vista previa.');
      if(previous && previous.deliveryUrl!==action.piece.deliveryUrl) throw new HttpsError('invalid-argument','Registra los enlaces con la acción de entrega para preservar versiones.');
      if(!previous && action.piece.deliveryUrl) throw new HttpsError('invalid-argument','Primero crea la pieza, luego registra su entrega.');
      if(!previous && next.pieces.length>=100) throw new HttpsError('resource-exhausted','Máximo 100 piezas por pedido.');
      next.pieces=previous ? next.pieces.map(p=>p.id===action.piece.id?action.piece:p) : [...next.pieces,action.piece];
      next.deckWarning=Boolean(next.channel&&(!next.deck||next.deck.channel!==next.channel));
    }
    if(action.kind==='status') {
      if(action.status==='Entregado') throw new HttpsError('failed-precondition','Usa la acción explícita de entregar.');
      if(action.status==='Bloqueado') {
        if(!action.reason.trim()) throw new HttpsError('invalid-argument','Indica el motivo del bloqueo.');
        if(action.resolverUid) await assignees(tx,[action.resolverUid],value);
        next.block={reason:action.reason,resolverUid:action.resolverUid,previousStatus:current.block?.previousStatus||current.status};
      } else next.block=null;
      next.status=action.status;next.review='Pendiente';
    }
    if(action.kind==='comment' || action.kind==='delivery') {
      if(action.pieceId && !next.pieces.some(p=>p.id===action.pieceId)) throw new HttpsError('not-found','No existe la pieza.');
    }
    if(action.kind==='comment')await assignees(tx,action.mentionedUids,value);
    if(action.kind==='delivery') {
      if(action.pieceId) next.pieces=next.pieces.map(p=>p.id===action.pieceId?{...p,deliveryUrl:action.url}:p); else next.deliveryUrl=action.url;
    }
    if(action.kind==='deliver') {
      if(action.url!==undefined)next.deliveryUrl=action.url||current.deliveryUrl;
      const error=readyForDelivery(next,action.exception);if(error) throw new HttpsError('failed-precondition',error);
      next.status='Entregado';next.block=null;next.review='Pendiente';Object.assign(next,{deliveryException:action.exception});
    }
    if(action.kind==='review') {
      if(current.status!=='Entregado' && current.status!=='En revisión' && current.status!=='Por validar') throw new HttpsError('failed-precondition','Primero solicita revisión o registra la entrega.');
      if(action.result==='Requiere ajustes' && !action.reason.trim()) throw new HttpsError('invalid-argument','Describe los ajustes.');
      next.review=action.result;next.status=action.result==='Requiere ajustes'?'En proceso':current.status;
    }
    if(action.kind==='archive') next.archived=action.archived;
    await tx.get(ref.collection('followerGuard').doc('global'));
    const subscribers=await tx.get(ref.collection('followers').limit(101));if(subscribers.size>100)throw new HttpsError('resource-exhausted','Este pedido supera 100 seguidores. Reduce las suscripciones antes de modificarlo.');
    const recipients=new Map<string,string>();for(const uid of assignedUids(next))if(uid!==request.auth!.uid)recipients.set(uid,'update');if(action.kind==='comment')for(const uid of action.mentionedUids)recipients.set(uid,'mention');
    for(const f of subscribers.docs)if(f.id!==request.auth!.uid&&!recipients.has(f.id))recipients.set(f.id,'update');
    const permitted=[];for(const [uid,type] of recipients){const person=await tx.get(db().doc(`teams/${value.teamId}/brands/${value.brandId}/people/${uid}`));if(person.exists)permitted.push({uid,type});}
    next.assignedUids=assignedUids(next);next.revision++;
    if(new TextEncoder().encode(JSON.stringify(next)).length>700000)throw new HttpsError('resource-exhausted','El pedido tiene demasiadas especificaciones. Reduce el contenido o divídelo en pedidos separados.');
    if(dependencyUpdate)tx.set(dependencyRef,{...(!isGeneralAdmin(editor)?{lastOrderId:value.orderId}:{}),nodes:dependencyUpdate.nodes,revision:dependencyUpdate.revision,updatedAt:FieldValue.serverTimestamp()});
    if(!isGeneralAdmin(editor)){Object.assign(next,{lastOperationId:value.operationId});collaborativeReceipt(tx,ref,current,next,value.operationId,action.kind);}
    tx.update(ref,{...next,updatedAt:FieldValue.serverTimestamp(),...(action.kind==='deliver'?{deliveredAt:FieldValue.serverTimestamp(),deliveryException:action.exception}:{})});
    const event={action:action.kind,actorUid:request.auth!.uid,createdAt:FieldValue.serverTimestamp(),revision:next.revision,...(action.kind==='status'?{status:action.status,reason:action.reason}:{}),...(action.kind==='review'?{result:action.result,reason:action.reason}:{}),...(action.kind==='deliver'?{exception:action.exception}:{}),...(action.kind==='piece'?{pieceId:action.piece.id,state:action.piece.state,reason:action.piece.reason}:{})};
    const changes=action.kind==='edit'?Object.fromEntries(Object.entries(action.fields).filter(([field,value])=>JSON.stringify(current[field as keyof Order])!==JSON.stringify(value)).map(([field,value])=>[field,{before:current[field as keyof Order]??null,after:value}])):undefined;
    tx.create(ref.collection('activity').doc(value.operationId),{...event,...(changes?{changes}:{}),...(action.kind==='archive'?{before:current.archived,after:next.archived}:{}),...(action.kind==='status'?{before:current.status,after:next.status}:{}),...(action.kind==='piece'?{previousPiece:current.pieces.find(p=>p.id===action.piece.id)||null,nextPiece:action.piece}:{}),...(action.kind==='delivery'&&action.pieceId?{previousPiece:current.pieces.find(p=>p.id===action.pieceId)||null,nextPiece:next.pieces.find(p=>p.id===action.pieceId)||null}:{}),...(action.kind==='comment'||action.kind==='delivery'?{pieceId:action.pieceId}:{})});
    if(action.kind==='comment') tx.create(ref.collection('comments').doc(value.operationId),{body:action.body,pieceId:action.pieceId,mentionedUids:action.mentionedUids,actorUid:request.auth!.uid,createdAt:FieldValue.serverTimestamp()});
    for(const {uid,type} of permitted){const notificationId=await sha256(`${ref.path}:${value.operationId}`);tx.create(db().doc(`notifications/${uid}/items/${notificationId}`),{type,teamId:value.teamId,brandId:value.brandId,orderId:value.orderId,operationId:value.operationId,revision:next.revision,actorUid:request.auth!.uid,createdAt:FieldValue.serverTimestamp(),read:false});}
    if(action.kind==='delivery'||(action.kind==='deliver'&&action.url)) tx.create(ref.collection('deliveries').doc(value.operationId),{url:action.url,pieceId:action.kind==='delivery'?action.pieceId:null,actorUid:request.auth!.uid,createdAt:FieldValue.serverTimestamp()});
  });return {status:'saved'};
});
