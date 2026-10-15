import { z } from 'zod';
import { assignedUids, type Order } from '../../shared/orders';
import { getFirestore, FieldValue, onCall, HttpsError, sha256, type Transaction, type Snapshot } from './store';
import { parse, requireAdmin, checkRevision } from './security';
export const deletionSections=['users','invitations','teams','brands','scopes','decks','orderTemplates','adminActivity','settings','orders','recurrences'] as const;
const selection=z.object({section:z.enum(deletionSections),id:z.string().regex(/^[a-zA-Z0-9_-]{1,160}$/),revision:z.number().int().min(0),teamId:z.string().regex(/^[a-zA-Z0-9-]{1,80}$/).optional(),brandId:z.string().regex(/^[a-zA-Z0-9-]{1,80}$/).optional()}).strict().refine(v=>v.section!=='orders'||Boolean(v.teamId&&v.brandId),'Selecciona el equipo y la marca del pedido.');
export interface DeletionPreview {fingerprint:string;label:string;deletes:number;updates:number;counts:Record<string,number>}
export type DeletionSelection=z.infer<typeof selection>;
type Selection=DeletionSelection;
const db=()=>getFirestore();
async function plan(tx:Transaction,value:Selection){
  const remove=new Map<string,Snapshot>(),updates=new Map<string,{before:Snapshot;fields:Record<string,unknown>}>();
  const root=await tx.get(db().doc(value.section==='orders'?`teams/${value.teamId}/brands/${value.brandId}/orders/${value.id}`:`${value.section}/${value.id}`));
  if(!root.exists)throw new HttpsError('not-found','Este registro ya no existe.');
  if(value.section==='adminActivity')throw new HttpsError('permission-denied','El historial se conserva y no puede eliminarse.');checkRevision(root.data(),value.revision);
  const bootstrap=await tx.get(db().doc('system/bootstrap'));
  if(value.section==='users'&&bootstrap.data()?.uid===value.id)throw new HttpsError('failed-precondition','El propietario inicial conserva su perfil para evitar perder el acceso al espacio.');
  const label=String(root.data().name||root.data().title||root.data().email||root.data().brandName||value.id);
  function budget(){if(remove.size+updates.size>400)throw new HttpsError('resource-exhausted','Esta eliminación supera 400 registros. No se borró nada; reduce el alcance eliminando primero pedidos o vínculos.');}
  function add(snapshot:Snapshot){if(snapshot.exists){remove.set(snapshot.ref.path,snapshot);updates.delete(snapshot.ref.path);budget();}}
  function change(snapshot:Snapshot,fields:Record<string,unknown>){if(!remove.has(snapshot.ref.path)){updates.set(snapshot.ref.path,{before:snapshot,fields:{...updates.get(snapshot.ref.path)?.fields,...fields}});budget();}}
  async function rows(path:string){const result=await tx.get(db().collection(path).limit(401));if(result.size>400)throw new HttpsError('resource-exhausted','Demasiados registros para una operación atómica. No se borró nada.');return result.docs;}
  async function children(snapshot:Snapshot,names:string[]){for(const name of names)for(const child of await rows(`${snapshot.ref.path}/${name}`))add(child);add(snapshot);}
  const removedScopes=new Set<string>();
  async function link(teamId:string,brandId:string){
    const path=`teams/${teamId}/brands/${brandId}`;for(const person of await rows(`${path}/people`))add(person);add(await tx.get(db().doc(`${path}/collaboration/directory`)));add(await tx.get(db().doc(`${path}/dependencies/graph`)));const scope=await tx.get(db().doc(path));
    if(scope.exists){for(const order of await rows(`${path}/orders`)){add(await tx.get(db().doc(`${order.ref.path}/followerGuard/global`)));await children(order,['comments','deliveries','activity','followers','followerGuard']);}add(scope);}
    removedScopes.add(`${teamId}__${brandId}`);add(await tx.get(db().doc(`scopes/${teamId}__${brandId}`)));
  }
  async function deck(snapshot:Snapshot){
    await children(snapshot,['versions']);
    for(const preview of (await tx.get(db().collection('deckPreviews').where('deck.id','==',snapshot.id).limit(401))).docs)await children(preview,['targets']);
  }
  if(value.section==='teams')for(const scope of await rows(`teams/${value.id}/brands`))await link(value.id,scope.id);
  if(value.section==='brands'){
    for(const team of await rows('teams'))await link(team.id,value.id);
    for(const item of (await tx.get(db().collection('decks').where('brandId','==',value.id).limit(401))).docs)await deck(item);
  }
  if(value.section==='scopes')await link(root.data().teamId,root.data().brandId);
  if(value.section==='decks'){
    await deck(root);const brand=await tx.get(db().doc(`brands/${root.data().brandId}`));
    if(brand.exists){const defaults={...brand.data().defaultDecks};let changed=false;for(const channel of Object.keys(defaults))if(defaults[channel]===value.id){defaults[channel]=null;changed=true;}if(changed)change(brand,{defaultDecks:defaults});}
  }
  if(value.section==='orderTemplates')await children(root,['versions']);
  if(value.section==='orders'){
    add(await tx.get(db().doc(`${root.ref.path}/followerGuard/global`)));await children(root,['comments','deliveries','activity','followers','followerGuard']);
    for(const user of await rows('users'))for(const item of await rows(`notifications/${user.id}/items`))if(item.data().teamId===value.teamId&&item.data().brandId===value.brandId&&item.data().orderId===value.id)add(item);
  }
  if(value.section==='users'){for(const scope of await rows('scopes')){const base=`teams/${scope.data().teamId}/brands/${scope.data().brandId}`;add(await tx.get(db().doc(`${base}/people/${value.id}`)));const directory=await tx.get(db().doc(`${base}/collaboration/directory`));if(directory.exists&&directory.data().uids.includes(value.id))change(directory,{uids:directory.data().uids.filter((uid:string)=>uid!==value.id)});}
    await children(root,['access','memberships','views','brandAccess']);
    for(const item of await rows(`notifications/${value.id}/items`))add(item);
    for(const invitation of (await tx.get(db().collection('invitations').where('email','==',root.data().email).limit(401))).docs)add(invitation);
    for(const scope of await rows('scopes'))for(const item of await rows(`teams/${scope.data().teamId}/brands/${scope.data().brandId}/orders`)){
      add(await tx.get(db().doc(`${item.ref.path}/followers/${value.id}`)));
      const order=item.data() as Order;const pieces=order.pieces.map(piece=>piece.assigneeUid===value.id?{...piece,assigneeUid:null}:piece);
      const next={...order,assigneeUid:order.assigneeUid===value.id?null:order.assigneeUid,collaborators:order.collaborators.filter(uid=>uid!==value.id),pieces,block:order.block?.resolverUid===value.id?{...order.block,resolverUid:null}:order.block};
      if(JSON.stringify(next)!==JSON.stringify(order))change(item,{assigneeUid:next.assigneeUid,collaborators:next.collaborators,pieces,block:next.block,assignedUids:assignedUids(next)});
    }
  }
  if(['teams','brands','scopes'].includes(value.section)){
    const affected=(s:{teamId:string;brandId:string})=>value.section==='teams'?s.teamId===value.id:value.section==='brands'?s.brandId===value.id:removedScopes.has(`${s.teamId}__${s.brandId}`);
    for(const user of await rows('users')){
      for(const grant of await rows(`${user.ref.path}/access`))if(affected(grant.data() as {teamId:string;brandId:string}))add(grant);
      if(value.section==='teams')add(await tx.get(db().doc(`${user.ref.path}/memberships/${value.id}`)));
      const oldScopes=user.data().scopes||[],oldTeams=user.data().teamIds||[];
      const scopes=oldScopes.filter((s:{teamId:string;brandId:string})=>!affected(s)),teamIds=oldTeams.filter((id:string)=>value.section!=='teams'||id!==value.id);
      for(const grant of await rows(`${user.ref.path}/brandAccess`)){const remaining=scopes.find((s:{brandId:string})=>s.brandId===grant.id);if(!remaining)add(grant);else if(affected(grant.data() as {teamId:string;brandId:string}))change(grant,remaining);}
      if(JSON.stringify(scopes)!==JSON.stringify(oldScopes)||JSON.stringify(teamIds)!==JSON.stringify(oldTeams))change(user,{scopes,teamIds});
      for(const notification of await rows(`notifications/${user.id}/items`))if(affected(notification.data() as {teamId:string;brandId:string}))add(notification);
    }
    for(const invitation of await rows('invitations')){
      const scopes=(invitation.data().scopes||[]).filter((s:{teamId:string;brandId:string})=>!affected(s));const teamIds=(invitation.data().teamIds||[]).filter((id:string)=>value.section!=='teams'||id!==value.id);
      if(JSON.stringify(scopes)!==JSON.stringify(invitation.data().scopes||[])||JSON.stringify(teamIds)!==JSON.stringify(invitation.data().teamIds||[]))change(invitation,{scopes,teamIds});
    }
    if(value.section==='teams')for(const brand of await rows('brands'))if(brand.data().automaticTeamId===value.id)change(brand,{automaticTeamId:null});
  }
  const removedOrders=new Set(Array.from(remove.keys()).filter(path=>path.split('/').at(-2)==='orders'));
  for(const scopePath of new Set([...removedOrders].map(path=>path.split('/orders/')[0]))){const ids=new Set([...removedOrders].filter(path=>path.startsWith(scopePath+'/orders/')).map(path=>path.split('/').at(-1)));for(const item of await rows(scopePath+'/orders')){if(remove.has(item.ref.path))continue;const before=item.data().dependencies||[],after=before.filter((id:string)=>!ids.has(id));if(before.length!==after.length)change(item,{dependencies:after});}const graph=await tx.get(db().doc(scopePath+'/dependencies/graph'));if(graph.exists&&!remove.has(graph.ref.path)){const nodes=Object.fromEntries(Object.entries(graph.data().nodes||{}).filter(([id])=>!ids.has(id)).map(([id,parents])=>[id,(parents as string[]).filter(p=>!ids.has(p))]));if(JSON.stringify(nodes)!==JSON.stringify(graph.data().nodes||{}))change(graph,{nodes});}}
  if(removedOrders.size)for(const preview of await rows('deckPreviews')){
    if(remove.has(preview.ref.path))continue;
    const targets=await rows(`${preview.ref.path}/targets`);
    if(targets.some(target=>removedOrders.has(`teams/${target.data().teamId}/brands/${target.data().brandId}/orders/${target.data().orderId}`))){for(const target of targets)add(target);add(preview);}
  }
  add(root);
  const counts:Record<string,number>={};for(const path of remove.keys()){const category=path.split('/').at(-2)!;counts[category]=(counts[category]||0)+1;}
  const signature=[...remove.values(),...Array.from(updates.values(),v=>v.before)].sort((a,b)=>a.ref.path.localeCompare(b.ref.path)).map(s=>[s.ref.path,s.data()]);
  function canonical(value:unknown):unknown {if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,canonical(v)]));return value;}
  const fingerprint=await sha256(JSON.stringify(canonical({value,signature,updates:Array.from(updates,([path,item])=>[path,item.fields])})));
  return {remove,updates,preview:{fingerprint,label,deletes:remove.size,updates:updates.size,counts} satisfies DeletionPreview};
}
export const previewDeletion=onCall({},async request=>{if(!request.auth)throw new HttpsError('unauthenticated','Debes ingresar.');const value=parse(selection,request.data);return db().runTransaction(async tx=>{await requireAdmin(tx,request.auth!.uid);return (await plan(tx,value)).preview;});});
export const deleteRecord=onCall({},async request=>{
  if(!request.auth)throw new HttpsError('unauthenticated','Debes ingresar.');
  const value=parse(selection.safeExtend({fingerprint:z.string().regex(/^[a-f0-9]{64}$/),confirmation:z.string().min(1).max(320),operationId:z.string().uuid()}).strict(),request.data);
  return db().runTransaction(async tx=>{
    await requireAdmin(tx,request.auth!.uid);const auditRef=db().doc(`adminActivity/delete-${value.operationId}`);const audit=await tx.get(auditRef);
    if(audit.exists){if(audit.data().actorUid!==request.auth!.uid||audit.data().section!==value.section||audit.data().recordId!==value.id||(audit.data().teamId||undefined)!==value.teamId||(audit.data().brandId||undefined)!==value.brandId)throw new HttpsError('permission-denied','Esta operación pertenece a otra eliminación.');return {status:'deleted'};}
    const result=await plan(tx,{section:value.section,id:value.id,revision:value.revision,...(value.teamId?{teamId:value.teamId}:{}),...(value.brandId?{brandId:value.brandId}:{})});
    if(result.preview.fingerprint!==value.fingerprint)throw new HttpsError('aborted','Los registros vinculados cambiaron. Revisa una nueva vista previa antes de eliminar.');
    if(value.confirmation!==result.preview.label)throw new HttpsError('invalid-argument','Escribe el nombre exacto para confirmar.');
    for(const item of result.updates.values())tx.update(item.before.ref,{...item.fields,revision:(item.before.data().revision||0)+1,updatedAt:FieldValue.serverTimestamp()});
    for(const snapshot of result.remove.values())tx.delete(snapshot.ref);
    tx.create(auditRef,{action:'deleted',actorUid:request.auth!.uid,section:value.section,recordId:value.id,...(value.teamId?{teamId:value.teamId}:{}),...(value.brandId?{brandId:value.brandId}:{}),label:result.preview.label,counts:result.preview.counts,updatedRecords:result.updates.size,createdAt:FieldValue.serverTimestamp()});
    return {status:'deleted'};
  });
});
