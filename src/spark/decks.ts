// Spark adapter. Derived from functions/src/decks.ts; enforce authorization in firestore.spark.rules.
import { getFirestore, FieldValue, Timestamp, FieldPath, type Transaction, type QuerySnapshot } from './store';
import { onCall, HttpsError } from './store';
import { sha256, randomUUID } from './store';
import { z } from 'zod';
import { scopeKey,scopeSchema } from '../../shared/access';
import { deckSchema,definitionOf,deckSnapshot,copyDeckPiece,mergeDeck,previewSchema,entityIdSchema,type Deck,type PreviewResult } from '../../shared/admin';
import { assignedUids,type Order } from '../../shared/orders';
import { parse,requireAdmin,requireActive,checkRevision,ensureSize } from './security';
const db=()=>getFirestore();const options={region:'us-central1',maxInstances:5};
export async function defaultDeck(tx:Transaction,brandId:string,channel:'WP'|'SIS'):Promise<Deck|null>{
  const brand=await tx.get(db().doc(`brands/${brandId}`));if(!brand.exists||brand.data()!.archived)return null;
  const id=brand.data()!.defaultDecks?.[channel];if(!id)return null;
  const deck=await tx.get(db().doc(`decks/${id}`));if(!deck.exists||deck.data()!.archived||deck.data()!.brandId!==brandId||deck.data()!.channel!==channel||!deck.data()!.pieces?.length)return null;
  return {id:deck.id,...deck.data()} as Deck;
}
export function copyDeck(deck:Deck){return deck.pieces.map(piece=>copyDeckPiece(piece,deck,randomUUID()));}
export const saveDeck=onCall(options,async request=>{
  if(!request.auth)throw new HttpsError('unauthenticated','Debes ingresar.');const value=parse(deckSchema,request.data);ensureSize(value,400000);
  await db().runTransaction(async tx=>{
    await requireAdmin(tx,request.auth!.uid);const ref=db().doc(`decks/${value.id}`),brandRef=db().doc(`brands/${value.brandId}`);
    const [current,brand]=await Promise.all([tx.get(ref),tx.get(brandRef)]);checkRevision(current.data(),value.revision);
    if(!brand.exists||brand.data()!.archived)throw new HttpsError('failed-precondition','La marca debe estar activa.');
    if(current.exists&&(current.data()!.brandId!==value.brandId||current.data()!.channel!==value.channel))throw new HttpsError('failed-precondition','La marca y canal de un deck son permanentes. Duplica para crear otra variante.');
    const revision=value.revision+1;
    const {isDefault,...definition}=value;
    const data={...definition,revision,updatedAt:FieldValue.serverTimestamp(),updatedBy:request.auth!.uid};
    const defaults={...(brand.data()!.defaultDecks||{})};
    if(isDefault&&!value.archived)defaults[value.channel]=value.id;else if(defaults[value.channel]===value.id)defaults[value.channel]=null;
    tx.set(ref,data);tx.create(ref.collection('versions').doc(String(revision)),data);
    tx.update(brandRef,{defaultDecks:defaults,revision:(brand.data()!.revision||0)+1,updatedAt:FieldValue.serverTimestamp()});
    tx.create(db().collection('adminActivity').doc(),{action:'deck',actorUid:request.auth!.uid,deckId:value.id,brandId:value.brandId,channel:value.channel,beforeRevision:current.data()?.revision||0,afterRevision:revision,archived:value.archived,isDefault:defaults[value.channel]===value.id,createdAt:FieldValue.serverTimestamp()});
  });return {status:'saved'};
});
export const loadDeckVersions=onCall(options,async request=>{
  if(!request.auth)throw new HttpsError('unauthenticated','Debes ingresar.');const value=parse(z.object({deckId:entityIdSchema,beforeRevision:z.number().int().min(1).nullable().default(null)}).strict(),request.data);
  return db().runTransaction(async tx=>{await requireAdmin(tx,request.auth!.uid);let query=db().collection(`decks/${value.deckId}/versions`).orderBy('revision','desc').limit(21);if(value.beforeRevision)query=query.startAfter(value.beforeRevision);const versions=await tx.get(query);return {versions:versions.docs.slice(0,20).map(doc=>({...doc.data(),updatedAt:doc.data().updatedAt?.toDate()?.toISOString()})),nextCursor:versions.size>20?versions.docs[19].data().revision:null};});
});
export const listBrandDecks=onCall(options,async request=>{
  if(!request.auth)throw new HttpsError('unauthenticated','Debes ingresar.');const value=parse(scopeSchema.extend({channel:z.enum(['WP','SIS'])}).strict(),request.data);
  return db().runTransaction(async tx=>{
    const user=await requireActive(tx,request.auth!.uid);const [grant,scope]=await Promise.all([tx.get(db().doc(`users/${request.auth!.uid}/access/${scopeKey(value.teamId,value.brandId)}`)),tx.get(db().doc(`teams/${value.teamId}/brands/${value.brandId}`))]);
    if(!scope.exists||scope.data()!.archived||(user.role!=='superadmin'&&!grant.exists))throw new HttpsError('permission-denied','No tienes acceso a esta marca y equipo.');
    const decks=await tx.get(db().collection('decks').where('brandId','==',value.brandId).where('channel','==',value.channel).where('archived','==',false));
    const brand=await tx.get(db().doc(`brands/${value.brandId}`));return decks.docs.map(doc=>({id:doc.id,...doc.data(),isDefault:brand.data()?.defaultDecks?.[value.channel]===doc.id,updatedAt:doc.data().updatedAt?.toDate()?.toISOString()}));
  });
});
export const previewDeckApply=onCall(options,async request=>{
  if(!request.auth)throw new HttpsError('unauthenticated','Debes ingresar.');const value=parse(previewSchema,request.data);
  if(new Set(value.targets.map(target=>`${scopeKey(target.teamId,target.brandId)}__${target.orderId}`)).size!==value.targets.length)throw new HttpsError('invalid-argument','Hay pedidos repetidos.');
  const previewId=randomUUID(),expiresAt=Timestamp.fromMillis(Date.now()+30*60*1000);
  return db().runTransaction(async tx=>{
    await requireAdmin(tx,request.auth!.uid);const deckDoc=await tx.get(db().doc(`decks/${value.deckId}`));if(!deckDoc.exists||deckDoc.data()!.archived)throw new HttpsError('not-found','El deck no está disponible.');checkRevision(deckDoc.data(),value.deckRevision);
    const deck={id:deckDoc.id,...deckDoc.data()} as Deck;
    const brand=await tx.get(db().doc(`brands/${deck.brandId}`));if(!brand.exists||brand.data()!.archived)throw new HttpsError('failed-precondition','La marca está archivada.');
    const targets=[];
    for(const target of value.targets){
      if(target.brandId!==deck.brandId)throw new HttpsError('invalid-argument','Todos los pedidos deben pertenecer a la marca del deck.');
      const [scope,order]=await Promise.all([tx.get(db().doc(`teams/${target.teamId}/brands/${target.brandId}`)),tx.get(db().doc(`teams/${target.teamId}/brands/${target.brandId}/orders/${target.orderId}`))]);
      if(!scope.exists||scope.data()!.archived||!order.exists)throw new HttpsError('failed-precondition','Uno de los pedidos o alcances no está disponible.');
      const current=order.data() as Order;if(current.archived||current.status==='Entregado'||current.channel!==deck.channel)throw new HttpsError('failed-precondition','Solo puedes aplicar decks a pedidos abiertos del mismo canal.');checkRevision(current as unknown as Record<string,unknown>,target.revision);
      const merged=mergeDeck(current,deck,randomUUID);if(merged.pieces.length>100)throw new HttpsError('resource-exhausted','El pedido superaría las 100 piezas. No se eliminan piezas para hacer espacio.');ensureSize({...current,pieces:merged.pieces});
      targets.push({targetId:String(targets.length),target,current,merged});
    }
    tx.create(db().doc(`deckPreviews/${previewId}`),{actorUid:request.auth!.uid,deck:deckSnapshot(deck),expiresAt,createdAt:FieldValue.serverTimestamp(),appliedTargets:[],targetIds:targets.map(item=>item.targetId)});
    for(const item of targets)tx.create(db().doc(`deckPreviews/${previewId}/targets/${item.targetId}`),{...item.target,title:item.current.title,pieces:item.merged.pieces,added:item.merged.added,updated:item.merged.updated,retired:item.merged.retired});
    const result:PreviewResult={previewId,expiresAt:expiresAt.toDate().toISOString(),deck:deckSnapshot(deck),targets:targets.map(item=>({targetId:item.targetId,title:item.current.title,teamId:item.target.teamId,brandId:item.target.brandId,changes:{added:item.merged.added,updated:item.merged.updated,retired:item.merged.retired},beforeCount:item.current.pieces.length,afterCount:item.merged.pieces.length,diff:[...item.merged.added,...item.merged.updated,...item.merged.retired].map(id=>{const before=item.current.pieces.find(piece=>piece.id===id);const after=item.merged.pieces.find(piece=>piece.id===id);const kind=item.merged.added.includes(id)?'añadida' as const:item.merged.retired.includes(id)?'retirada' as const:'actualizada' as const;return {pieceId:id,name:after?.name||before!.name,kind,before:before?definitionOf(before):null,after:after?definitionOf(after):null};})}))};ensureSize(result,5000000);return result;
  });
});
export const applyDeckPreview=onCall(options,async request=>{
  if(!request.auth)throw new HttpsError('unauthenticated','Debes ingresar.');const value=parse(z.object({previewId:entityIdSchema,selectedTargets:z.array(z.string().regex(/^\d{1,2}$/)).min(1).max(20)}).strict(),request.data);
  await db().runTransaction(async tx=>{
    await requireAdmin(tx,request.auth!.uid);const ref=db().doc(`deckPreviews/${value.previewId}`),preview=await tx.get(ref);
    if(!preview.exists||preview.data()!.actorUid!==request.auth!.uid)throw new HttpsError('permission-denied','Esta vista previa no te pertenece.');
    const data=preview.data()!;if(data.expiresAt.toMillis()<Date.now())throw new HttpsError('failed-precondition','La vista previa expiró. Genera una nueva.');
    const deck=await tx.get(db().doc(`decks/${data.deck.id}`));if(!deck.exists||deck.data()!.archived)throw new HttpsError('failed-precondition','El deck ya no está disponible.');checkRevision(deck.data(),data.deck.revision);
    const selected=[...new Set(value.selectedTargets)];if(selected.some(id=>!data.targetIds.includes(id)))throw new HttpsError('invalid-argument','Seleccionaste un pedido fuera de la vista previa.');
    const updates=[];
    for(const id of selected){if(data.appliedTargets.includes(id))continue;const target=await tx.get(ref.collection('targets').doc(id));if(!target.exists)throw new HttpsError('not-found','No se encuentra el pedido de la vista previa.');const value=target.data()!;const orderRef=db().doc(`teams/${value.teamId}/brands/${value.brandId}/orders/${value.orderId}`);const [order,scope]=await Promise.all([tx.get(orderRef),tx.get(db().doc(`teams/${value.teamId}/brands/${value.brandId}`))]);if(!order.exists||!scope.exists||scope.data()!.archived)throw new HttpsError('failed-precondition','El pedido o alcance ya no está disponible.');const current=order.data() as Order;checkRevision(current as unknown as Record<string,unknown>,value.revision);if(current.archived||current.status==='Entregado'||current.channel!==data.deck.channel)throw new HttpsError('failed-precondition','El pedido ya no es elegible para este deck.');updates.push({orderRef,current,target:value});}
    for(const update of updates){const {orderRef,current,target}=update;const next={...current,pieces:target.pieces};tx.update(orderRef,{pieces:target.pieces,deck:data.deck,deckWarning:false,assignedUids:assignedUids(next),revision:current.revision+1,updatedAt:FieldValue.serverTimestamp()});tx.create(orderRef.collection('activity').doc(`deck-${value.previewId}`),{action:'deckApplied',actorUid:request.auth!.uid,deckId:data.deck.id,fromRevision:current.deck?.revision||null,toRevision:data.deck.revision,added:target.added,updated:target.updated,retired:target.retired,createdAt:FieldValue.serverTimestamp()});}
    tx.update(ref,{appliedTargets:[...new Set([...data.appliedTargets,...selected])]});
    if(updates.length)tx.create(db().collection('adminActivity').doc(),{action:'deckApply',actorUid:request.auth!.uid,previewId:value.previewId,deckId:data.deck.id,targets:updates.map(update=>({path:update.orderRef.path,revision:update.current.revision})),createdAt:FieldValue.serverTimestamp()});
  });return {status:'applied'};
});
