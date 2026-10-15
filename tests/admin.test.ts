import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import {initializeApp,deleteApp} from 'firebase/app';
import {getAuth,connectAuthEmulator,GoogleAuthProvider,signInWithCredential,signOut} from 'firebase/auth';
import {getFunctions,connectFunctionsEmulator,httpsCallable} from 'firebase/functions';
import {initializeApp as adminApp,deleteApp as deleteAdmin} from 'firebase-admin/app';
import {getFirestore,Timestamp} from 'firebase-admin/firestore';
import type {Deck,PreviewResult} from '../shared/admin';
import type {Order} from '../shared/orders';
if(!process.env.FIRESTORE_EMULATOR_HOST||!process.env.FIREBASE_AUTH_EMULATOR_HOST)throw new Error('Solo emuladores para esta suite.');
const app=initializeApp({projectId:'demo-funka',apiKey:'demo-key'},'admin-spec'),app2=initializeApp({projectId:'demo-funka',apiKey:'demo-key'},'admin-spec-2');
const auth=getAuth(app),auth2=getAuth(app2),fn=getFunctions(app),fn2=getFunctions(app2);
for(const [a,f] of [[auth,fn],[auth2,fn2]] as const){connectAuthEmulator(a,'http://127.0.0.1:9099',{disableWarnings:true});connectFunctionsEmulator(f,'127.0.0.1',5001);}
const admin=adminApp({projectId:'demo-funka'},'admin-spec-server'),db=getFirestore(admin);
async function google(email:string,subject:string,a=auth){await signOut(a);const encode=(value:object)=>Buffer.from(JSON.stringify(value)).toString('base64url');return (await signInWithCredential(a,GoogleAuthProvider.credential(`${encode({alg:'none',typ:'JWT'})}.${encode({sub:subject,email,email_verified:true,iss:'https://accounts.google.com',aud:'demo-funka',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+3600})}.`))).user;}
const invoke=<T=unknown>(name:string,value:unknown,f=fn)=>httpsCallable<unknown,T>(f,name)(value).then(result=>result.data);
const scope={teamId:'admin-team',brandId:'cat'};
const orderRef=(id:string)=>db.doc(`teams/${scope.teamId}/brands/${scope.brandId}/orders/${id}`);
const currentOrder=async(id:string)=>(await orderRef(id).get()).data() as Order;
async function mutation(id:string,action:unknown){const order=await currentOrder(id);return invoke('mutateOrder',{...scope,orderId:id,revision:order.revision,operationId:crypto.randomUUID(),action});}
let ownerUid='',memberUid='';
let wp:Deck={id:'deck-wp',revision:0,brandId:'cat',channel:'WP',name:'Web propia',description:'Deck WP',archived:false,isDefault:true,pieces:[{id:'banner-template',name:'Banner WP',quantity:1,measures:'1200x600',format:'PNG',specs:'Brief WP',references:[],group:'Web',order:0,required:true},{id:'optional-template',name:'Story opcional',quantity:1,measures:'1080x1920',format:'PNG',specs:'',references:[],group:'Social',order:1,required:false}]};
beforeAll(async()=>{for(const collection of await db.listCollections())await db.recursiveDelete(collection);const owner=await google('joel.yc23@gmail.com','admin-owner');ownerUid=owner.uid;await invoke('establishAccess',{});await invoke('createScope',{...scope,teamName:'Equipo creativo',brandName:'CAT'});});
afterAll(async()=>{await deleteApp(app);await deleteApp(app2);await deleteAdmin(admin);});
describe('Administración con permisos reales',()=>{
 it('un usuario pendiente no puede consultar ni editar administración',async()=>{
   const member=await google('admin-member@example.test','admin-member');memberUid=member.uid;await invoke('establishAccess',{});
   for(const [name,payload] of [['listAdmin',{section:'users'}],['saveSettings',{revision:0,settings:{requestTypes:['Otro'],deliveryHour:'17:00',syncHour:'07:00',autoDeadlineDays:2}}],['saveDeck',wp]] as const)await expect(invoke(name,payload)).rejects.toMatchObject({code:'functions/permission-denied'});
   await google('joel.yc23@gmail.com','admin-owner');
 });
 it('autoriza un correo pendiente y distingue membresía de acceso a marca',async()=>{
   await invoke('saveInvitation',{email:'admin-member@example.test',active:true,revision:0,teamIds:[scope.teamId],scopes:[]});
   const member=(await db.doc(`users/${memberUid}`).get()).data()!;expect(member).toMatchObject({active:true,role:'member',teamIds:[scope.teamId],scopes:[]});
   await google('admin-member@example.test','admin-member');expect(await invoke('listScopes',{})).toEqual([]);
   await expect(invoke('createOrder',{...scope,requestId:'forbidden-team-member',title:'No autorizado'})).rejects.toMatchObject({code:'functions/permission-denied'});
   await google('joel.yc23@gmail.com','admin-owner');
   await invoke('saveMember',{uid:memberUid,revision:member.revision,active:true,role:'member',teamIds:[scope.teamId],scopes:[scope]});
   expect((await db.doc(`users/${memberUid}/access/admin-team__cat`).get()).exists).toBe(true);
 });
 it('protege al último superadmin, también ante dos desactivaciones simultáneas',async()=>{
   const owner=(await db.doc(`users/${ownerUid}`).get()).data()!;
   await expect(invoke('saveMember',{uid:ownerUid,revision:owner.revision,active:false,role:'superadmin',teamIds:[],scopes:[]})).rejects.toMatchObject({code:'functions/failed-precondition'});
   const second=await google('second-admin@example.test','second-admin',auth2);await invoke('establishAccess',{},fn2);
   const pending=(await db.doc(`users/${second.uid}`).get()).data()!;
   await invoke('saveMember',{uid:second.uid,revision:pending.revision,active:true,role:'superadmin',teamIds:[],scopes:[]});
   const targets=await Promise.all([db.doc(`users/${ownerUid}`).get(),db.doc(`users/${second.uid}`).get()]);
   const results=await Promise.allSettled([invoke('saveMember',{uid:ownerUid,revision:targets[0].data()!.revision,active:false,role:'superadmin',teamIds:[],scopes:[]}),invoke('saveMember',{uid:second.uid,revision:targets[1].data()!.revision,active:false,role:'superadmin',teamIds:[],scopes:[]},fn2)]);
   expect(results.filter(result=>result.status==='fulfilled')).toHaveLength(1);expect(results.filter(result=>result.status==='rejected')).toHaveLength(1);
   const remaining=await db.collection('users').where('active','==',true).where('role','==','superadmin').get();expect(remaining.size).toBe(1);
   const disabledUid=remaining.docs[0].id===ownerUid?second.uid:ownerUid;const disabled=(await db.doc(`users/${disabledUid}`).get()).data()!;
   await invoke('saveMember',{uid:disabledUid,revision:disabled.revision,active:true,role:'superadmin',teamIds:[],scopes:[]},remaining.docs[0].id===ownerUid?fn:fn2);
 });
 it('revoca grants y evita reactivación por iniciar sesión; rechaza revisión obsoleta',async()=>{
   const ref=db.doc(`users/${memberUid}`),member=(await ref.get()).data()!;
   await invoke('saveMember',{uid:memberUid,revision:member.revision,active:false,role:'member',teamIds:[scope.teamId],scopes:[]});
   expect((await ref.collection('access').get()).size).toBe(0);
   await expect(invoke('saveMember',{uid:memberUid,revision:member.revision,active:true,role:'member',teamIds:[scope.teamId],scopes:[scope]})).rejects.toMatchObject({code:'functions/aborted'});
   await google('admin-member@example.test','admin-member');await invoke('establishAccess',{});expect((await ref.get()).data()!.active).toBe(false);
   await expect(invoke('listScopes',{})).rejects.toMatchObject({code:'functions/permission-denied'});
   await google('joel.yc23@gmail.com','admin-owner');const disabled=(await ref.get()).data()!;
   await invoke('saveMember',{uid:memberUid,revision:disabled.revision,active:true,role:'member',teamIds:[scope.teamId],scopes:[scope]});
 });
});
describe('Decks, versiones y aplicación selectiva',()=>{
 it('decks WP y SIS generan copias distintas y no inventan piezas si falta deck',async()=>{
   await invoke('saveDeck',wp);wp={...wp,revision:1};
   await invoke('saveDeck',{...wp,id:'deck-sis',revision:0,channel:'SIS',name:'Multimarca',pieces:[{...wp.pieces[0],id:'sis-template',name:'Banner SIS',measures:'1000x500'}]});
   for(const [requestId,channel] of [['wp-a','WP'],['wp-b','WP'],['sis-a','SIS']] as const)await invoke('createOrder',{...scope,requestId,title:requestId,channel});
   expect((await currentOrder('wp-a')).pieces[0].name).toBe('Banner WP');expect((await currentOrder('sis-a')).pieces[0].name).toBe('Banner SIS');
   const missingScope={teamId:'admin-team',brandId:'fila'};await invoke('createScope',{...missingScope,teamName:'Equipo creativo',brandName:'FILA'});await invoke('createOrder',{...missingScope,requestId:'missing-deck',title:'Sin deck',channel:'WP'});
   expect((await db.doc('teams/admin-team/brands/fila/orders/missing-deck').get()).data()).toMatchObject({deckWarning:true,pieces:[]});
 });
 it('editar plantilla mantiene intactos los pedidos anteriores y versiones',async()=>{
   const order=await currentOrder('wp-a'),piece={...order.pieces[0],state:'Lista',assigneeUid:memberUid,deadline:'2026-10-15T22:00:00.000Z'};
   await mutation('wp-a',{kind:'piece',piece});await mutation('wp-a',{kind:'comment',body:'Progreso que debe conservarse',pieceId:piece.id});await mutation('wp-a',{kind:'delivery',url:'https://mega.nz/file/template-test#FULL-key',pieceId:piece.id});
   await mutation('wp-a',{kind:'edit',fields:{title:order.title,description:'Brief manual',type:'Otro',channel:'WP',priority:'Normal',assigneeUid:null,collaborators:[],deadline:'2026-10-14T22:00:00.000Z'}});
   const updated={...wp,pieces:[{...wp.pieces[0],name:'Banner WP actualizado',measures:'1600x900'},{...wp.pieces[0],id:'new-template',name:'Nueva pieza',required:false,order:2}]};await invoke('saveDeck',updated);wp={...updated,revision:2};
   expect((await currentOrder('wp-a')).pieces[0]).toMatchObject({name:'Banner WP',state:'Lista',assigneeUid:memberUid});
   const versions=await invoke<{versions:Deck[]}>('loadDeckVersions',{deckId:wp.id});expect(versions.versions.map(version=>version.revision)).toEqual([2,1]);expect(versions.versions[1].pieces[0].measures).toBe('1200x600');
 });
 it('preview y selección conservan responsables, progreso, comentarios, enlaces y deadlines',async()=>{
   const a=await currentOrder('wp-a'),b=await currentOrder('wp-b');const preview=await invoke<PreviewResult>('previewDeckApply',{deckId:wp.id,deckRevision:wp.revision,targets:[{...scope,orderId:a.id,revision:a.revision},{...scope,orderId:b.id,revision:b.revision}]});
   expect(preview.targets[0].diff.find(change=>change.pieceId===a.pieces[0].id)).toMatchObject({before:{measures:'1200x600'},after:{measures:'1600x900'}});
   await invoke('applyDeckPreview',{previewId:preview.previewId,selectedTargets:['0']});const next=await currentOrder('wp-a');
   expect(next.pieces[0]).toMatchObject({id:a.pieces[0].id,name:'Banner WP actualizado',state:'Lista',assigneeUid:memberUid,deadline:'2026-10-15T22:00:00.000Z',deliveryUrl:'https://mega.nz/file/template-test#FULL-key',source:{deckId:wp.id,revision:2}});
   expect(next.deadline).toBe('2026-10-14T22:00:00.000Z');expect(next.deadlineMode).toBe('manual');expect(next.pieces.some(piece=>piece.retired)).toBe(true);expect(next.pieces).toHaveLength(3);
   expect((await orderRef('wp-a').collection('comments').get()).docs[0].data().body).toBe('Progreso que debe conservarse');expect((await orderRef('wp-a').collection('deliveries').get()).size).toBe(1);
   expect((await currentOrder('wp-b')).pieces[0].name).toBe('Banner WP');expect((await currentOrder('wp-b')).deck!.revision).toBe(1);
   await invoke('applyDeckPreview',{previewId:preview.previewId,selectedTargets:['0']});expect((await currentOrder('wp-a')).revision).toBe(next.revision);
 });
 it('rechaza origen falsificado, preview ajeno, vencido y pedidos modificados después del preview',async()=>{
   const a=await currentOrder('wp-a');await expect(mutation('wp-a',{kind:'piece',piece:{...a.pieces[0],source:{...a.pieces[0].source,revision:99}}})).rejects.toMatchObject({code:'functions/invalid-argument'});
   const b=await currentOrder('wp-b');const preview=await invoke<PreviewResult>('previewDeckApply',{deckId:wp.id,deckRevision:wp.revision,targets:[{...scope,orderId:b.id,revision:b.revision}]});
   await google('admin-member@example.test','admin-member');await expect(invoke('applyDeckPreview',{previewId:preview.previewId,selectedTargets:['0']})).rejects.toMatchObject({code:'functions/permission-denied'});
   await google('joel.yc23@gmail.com','admin-owner');await mutation('wp-b',{kind:'comment',body:'Cambio concurrente'});await expect(invoke('applyDeckPreview',{previewId:preview.previewId,selectedTargets:['0']})).rejects.toMatchObject({code:'functions/aborted'});
   const fresh=await currentOrder('wp-b'),expired=await invoke<PreviewResult>('previewDeckApply',{deckId:wp.id,deckRevision:wp.revision,targets:[{...scope,orderId:fresh.id,revision:fresh.revision}]});await db.doc(`deckPreviews/${expired.previewId}`).update({expiresAt:Timestamp.fromMillis(Date.now()-1000)});await expect(invoke('applyDeckPreview',{previewId:expired.previewId,selectedTargets:['0']})).rejects.toMatchObject({code:'functions/failed-precondition'});
 });
});
describe('Archivo y configuración',()=>{
 it('archiva y recupera entidades sin borrar pedidos ni grants',async()=>{
   const brand=(await db.doc('brands/cat').get()).data()!;await invoke('saveEntity',{kind:'brands',id:'cat',revision:brand.revision,name:'CAT',archived:true,automaticTeamId:null});
   expect((await db.doc('teams/admin-team/brands/cat').get()).data()!.archived).toBe(true);expect((await orderRef('wp-a').get()).exists).toBe(true);
   const memberBefore=(await db.doc(`users/${memberUid}`).get()).data()!;await invoke('saveMember',{uid:memberUid,revision:memberBefore.revision,active:true,role:'member',teamIds:[scope.teamId],scopes:[scope]});expect((await db.doc(`users/${memberUid}/access/admin-team__cat`).get()).exists).toBe(true);
   await google('admin-member@example.test','admin-member');expect(await invoke('listScopes',{})).toEqual([]);await expect(mutation('wp-a',{kind:'comment',body:'No autorizado sobre archivo'})).rejects.toMatchObject({code:'functions/permission-denied'});
   await google('joel.yc23@gmail.com','admin-owner');const archived=(await db.doc('brands/cat').get()).data()!;await invoke('saveEntity',{kind:'brands',id:'cat',revision:archived.revision,name:'CAT',archived:false,automaticTeamId:scope.teamId});expect((await db.doc('teams/admin-team/brands/cat').get()).data()!.archived).toBe(false);
   expect((await db.doc(`users/${memberUid}/access/admin-team__cat`).get()).exists).toBe(true);
 });
 it('configura tipos sin reescribir pedidos y registra actividad inmutable',async()=>{
   await invoke('saveSettings',{revision:0,settings:{requestTypes:['Otro','Diseño especial'],deliveryHour:'18:00',syncHour:'08:30',autoDeadlineDays:2}});
   expect(await invoke('getSettings',{})).toMatchObject({requestTypes:['Otro','Diseño especial'],deliveryHour:'18:00',timeZone:'America/Lima'});
   const before=await currentOrder('wp-a');await mutation('wp-a',{kind:'edit',fields:{title:before.title,description:before.description,type:'Diseño especial',channel:before.channel,priority:before.priority,assigneeUid:before.assigneeUid,collaborators:before.collaborators,deadline:before.deadline}});expect((await currentOrder('wp-a')).type).toBe('Diseño especial');
   const audit=await invoke<{records:{createdAt:string;actorName:string}[]}>('listAdmin',{section:'adminActivity'});expect(audit.records.length).toBeGreaterThan(0);expect(audit.records[0].actorName).toBeTruthy();expect(audit.records.every((entry,index)=>index===0||entry.createdAt<=audit.records[index-1].createdAt)).toBe(true);expect((await currentOrder('wp-b')).type).toBe('Otro');
 });
 it('las plantillas de brief se copian y sus cambios no reescriben pedidos anteriores',async()=>{
   const template={id:'brief-template',revision:0,name:'Brief de ecommerce',title:'Pedido de ecommerce',description:'Objetivo y referencias',type:'Diseño especial',channel:'WP',priority:'Alta',archived:false};
   await invoke('saveOrderTemplate',template);
   await invoke('createOrder',{...scope,requestId:'from-brief-template',title:'Título personalizado',templateId:template.id});
   const original=await currentOrder('from-brief-template');expect(original).toMatchObject({title:'Título personalizado',description:'Objetivo y referencias',type:'Diseño especial',priority:'Alta',channel:'WP',orderTemplate:{id:template.id,revision:1}});expect(original.deck!.id).toBe(wp.id);
   await invoke('saveOrderTemplate',{...template,revision:1,description:'Objetivo actualizado'});expect((await currentOrder('from-brief-template')).description).toBe('Objetivo y referencias');
   await google('admin-member@example.test','admin-member');await expect(invoke('saveOrderTemplate',{...template,revision:2})).rejects.toMatchObject({code:'functions/permission-denied'});await google('joel.yc23@gmail.com','admin-owner');
 });

});
