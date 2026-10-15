import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, it } from 'vitest';
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, writeBatch, serverTimestamp, collection, getDocs } from 'firebase/firestore';
let env:RulesTestEnvironment;
const google=(email:string)=>({email,email_verified:true,firebase:{sign_in_provider:'google.com'}});
beforeAll(async()=>{
  if(!process.env.FIRESTORE_EMULATOR_HOST)throw new Error('Solo emuladores.');
  env=await initializeTestEnvironment({projectId:'demo-funka',firestore:{host:'127.0.0.1',port:8080,rules:readFileSync('firestore.spark.rules','utf8')}});
  await env.clearFirestore();
});
afterAll(async()=>env.cleanup());
function profile(uid:string,email:string,owner=false){return {uid,email,displayName:'Prueba',googleVerified:true,authProvider:'google.com',active:owner,role:owner?'superadmin':'pending',scopes:[],teamIds:[],revision:1,createdAt:serverTimestamp()};}
it('niega bootstrap anónimo, no Google, no verificado y correo ajeno',async()=>{
  for(const ctx of [env.unauthenticatedContext(),env.authenticatedContext('bad',{...google('joel.yc23@gmail.com'),email_verified:false}),env.authenticatedContext('bad',{...google('joel.yc23@gmail.com'),firebase:{sign_in_provider:'password'}}),env.authenticatedContext('bad',google('other@example.test'))])
    await assertFails(setDoc(doc(ctx.firestore(),'system/bootstrap'),{uid:'bad',email:'joel.yc23@gmail.com',createdAt:serverTimestamp()}));
});
it('bootstrap fija al propietario verificado con perfil atómico',async()=>{
  const db=env.authenticatedContext('owner',google('joel.yc23@gmail.com')).firestore();const b=writeBatch(db);
  b.set(doc(db,'system/bootstrap'),{uid:'owner',email:'joel.yc23@gmail.com',createdAt:serverTimestamp()});b.set(doc(db,'users/owner'),profile('owner','joel.yc23@gmail.com',true));await assertSucceeds(b.commit());
});
it('otro UID no puede apropiarse del bootstrap ni crear segundo owner',async()=>{
  const db=env.authenticatedContext('second',google('joel.yc23@gmail.com')).firestore();await assertFails(setDoc(doc(db,'system/bootstrap'),{uid:'second',email:'joel.yc23@gmail.com',createdAt:serverTimestamp()}));await assertFails(setDoc(doc(db,'users/second'),profile('second','joel.yc23@gmail.com',true)));
});
it('permite perfil pendiente propio, niega identidad y privilegios forjados',async()=>{
  const db=env.authenticatedContext('member',google('member@example.test')).firestore();await assertFails(setDoc(doc(db,'users/member'),profile('member','joel.yc23@gmail.com')));await assertFails(setDoc(doc(db,'users/member'),profile('member','member@example.test',true)));await assertSucceeds(setDoc(doc(db,'users/member'),profile('member','member@example.test')));await assertFails(updateDoc(doc(db,'users/member'),{active:true,role:'superadmin'}));
});
it('pendiente no consulta colecciones administrativas ni pedidos',async()=>{
  const db=env.authenticatedContext('member',google('member@example.test')).firestore();await assertFails(getDocs(collection(db,'users')));await assertFails(getDocs(collection(db,'teams/a/brands/b/orders')));
});
it('owner no puede ser borrado, desactivado ni cambiar identidad',async()=>{
  const db=env.authenticatedContext('owner',google('joel.yc23@gmail.com')).firestore();await assertFails(deleteDoc(doc(db,'users/owner')));await assertFails(updateDoc(doc(db,'users/owner'),{active:false,revision:2,updatedAt:serverTimestamp()}));await assertFails(updateDoc(doc(db,'users/owner'),{email:'new@example.test',revision:2,updatedAt:serverTimestamp()}));
});
it('admin autoriza miembro y combinación; miembro solo lee su alcance',async()=>{
  const db=env.authenticatedContext('owner',google('joel.yc23@gmail.com')).firestore();await assertSucceeds(updateDoc(doc(db,'users/member'),{active:true,role:'member',revision:2,updatedAt:serverTimestamp(),scopes:[{teamId:'a',brandId:'b'}],teamIds:['a']}));await setDoc(doc(db,'users/member/access/a__b'),{teamId:'a',brandId:'b'});await setDoc(doc(db,'teams/a/brands/b'),{archived:false});await setDoc(doc(db,'teams/a/brands/c'),{archived:false});
  const m=env.authenticatedContext('member',google('member@example.test')).firestore();await assertSucceeds(getDocs(collection(m,'teams/a/brands/b/orders')));await assertFails(getDocs(collection(m,'teams/a/brands/c/orders')));await assertFails(setDoc(doc(m,'teams/a/brands/b/orders/x'),{title:'Ataque'}));await assertFails(setDoc(doc(m,'users/member/access/a__c'),{teamId:'a',brandId:'c'}));
});
it('pedidos fijan alcance autor fechas y revisiones',async()=>{
  const db=env.authenticatedContext('owner',google('joel.yc23@gmail.com')).firestore();const ref=doc(db,'teams/a/brands/b/orders/x');await assertFails(setDoc(ref,{id:'x',teamId:'a',brandId:'c',createdBy:'owner',revision:1,createdAt:serverTimestamp(),updatedAt:serverTimestamp()}));await assertSucceeds(setDoc(ref,{id:'x',teamId:'a',brandId:'b',createdBy:'owner',revision:1,createdAt:serverTimestamp(),updatedAt:serverTimestamp()}));await assertFails(updateDoc(ref,{createdBy:'member',revision:2,updatedAt:serverTimestamp()}));await assertFails(updateDoc(ref,{revision:1,updatedAt:serverTimestamp()}));await assertSucceeds(updateDoc(ref,{title:'Edición',revision:2,updatedAt:serverTimestamp()}));
});
it('actividad fija autor y tiempo; admin puede eliminar pero no sobrescribir',async()=>{
  const db=env.authenticatedContext('owner',google('joel.yc23@gmail.com')).firestore();const ref=doc(db,'teams/a/brands/b/orders/x/activity/event');await assertFails(setDoc(ref,{actorUid:'member',createdAt:serverTimestamp()}));await assertSucceeds(setDoc(ref,{actorUid:'owner',createdAt:serverTimestamp(),action:'edit'}));await assertFails(updateDoc(ref,{action:'falso'}));await assertSucceeds(deleteDoc(ref));
});
it('miembro no escribe comentarios ni configuraciones por API directa',async()=>{
  const db=env.authenticatedContext('member',google('member@example.test')).firestore();for(const path of ['teams/a/brands/b/orders/x/comments/c','settings/general','decks/test','system/sparkGuard','invitations/test'])await assertFails(setDoc(doc(db,path),{actorUid:'member',createdAt:serverTimestamp()}));
});
it('versiones de deck y brief no se sobrescriben',async()=>{
  const db=env.authenticatedContext('owner',google('joel.yc23@gmail.com')).firestore();for(const path of ['decks/d/versions/1','orderTemplates/t/versions/1']){await assertSucceeds(setDoc(doc(db,path),{revision:1}));await assertFails(setDoc(doc(db,path),{revision:2}));await assertSucceeds(deleteDoc(doc(db,path)));}
});
it('revocación y archivo cortan lectura sin confiar en interfaz',async()=>{
  const db=env.authenticatedContext('owner',google('joel.yc23@gmail.com')).firestore();const m=env.authenticatedContext('member',google('member@example.test')).firestore();await updateDoc(doc(db,'teams/a/brands/b'),{archived:true});await assertFails(getDoc(doc(m,'teams/a/brands/b/orders/x')));await updateDoc(doc(db,'teams/a/brands/b'),{archived:false});await updateDoc(doc(db,'users/member'),{active:false,revision:3,updatedAt:serverTimestamp()});await assertFails(getDoc(doc(m,'teams/a/brands/b/orders/x')));
});

it('branding público admite solo imágenes permitidas y escrituras de superadmin',async()=>{
  const a=env.authenticatedContext('owner',google('joel.yc23@gmail.com')).firestore();const anonymous=env.unauthenticatedContext().firestore();
  const image='data:image/png;base64,iVBORw0KGgo=';const value={logoData:image,symbolData:null,revision:1,updatedAt:serverTimestamp()};
  await assertFails(setDoc(doc(anonymous,'branding/public'),value));
  await assertFails(setDoc(doc(a,'branding/public'),{...value,logoData:'data:image/svg+xml;base64,PHN2Zz4='}));
  await assertFails(setDoc(doc(a,'branding/public'),{...value,secret:'No debe publicarse'}));
  await assertSucceeds(setDoc(doc(a,'branding/public'),value));await assertSucceeds(getDoc(doc(anonymous,'branding/public')));
  await assertFails(getDocs(collection(anonymous,'branding')));await assertFails(getDoc(doc(anonymous,'branding/private')));
  const member=env.authenticatedContext('member',google('member@example.test')).firestore();await assertFails(updateDoc(doc(member,'branding/public'),{revision:2,updatedAt:serverTimestamp()}));
  await assertFails(updateDoc(doc(a,'branding/public'),{logoData:'data:image/png;base64,'+'A'.repeat(350001),revision:2,updatedAt:serverTimestamp()}));
  await assertSucceeds(updateDoc(doc(a,'branding/public'),{logoData:null,revision:2,updatedAt:serverTimestamp()}));
});
it('solo superadmin elimina entidades y perfiles ajenos; protege bootstrap y guard',async()=>{
  const a=env.authenticatedContext('owner',google('joel.yc23@gmail.com')).firestore();
  const m=env.authenticatedContext('member',google('member@example.test')).firestore();
  await updateDoc(doc(a,'users/member'),{active:true,revision:4,updatedAt:serverTimestamp()});
  for(const path of ['teams/a','brands/deletable','decks/deletable','orderTemplates/deletable','invitations/deletable','settings/general','adminActivity/deletable']){
    await setDoc(doc(a,path),path.startsWith('adminActivity')?{actorUid:'owner',createdAt:serverTimestamp()}:{name:'Eliminar'});
    await assertFails(deleteDoc(doc(m,path)));await assertFails(deleteDoc(doc(env.unauthenticatedContext().firestore(),path)));if(path.startsWith('adminActivity'))await assertFails(deleteDoc(doc(a,path)));else await assertSucceeds(deleteDoc(doc(a,path)));
  }
  await assertFails(deleteDoc(doc(a,'system/bootstrap')));await assertFails(deleteDoc(doc(a,'system/sparkGuard')));await assertFails(deleteDoc(doc(a,'users/owner')));await assertSucceeds(deleteDoc(doc(a,'users/member')));
});
it('vistas propias permiten escritura al miembro, con revisión, sin escalar ni leer otro miembro',async()=>{
  const a=env.authenticatedContext('owner',google('joel.yc23@gmail.com')).firestore();
  const one=env.authenticatedContext('prefs-one',google('prefs-one@example.test')).firestore(),two=env.authenticatedContext('prefs-two',google('prefs-two@example.test')).firestore();
  for(const [uid,email,database] of [['prefs-one','prefs-one@example.test',one],['prefs-two','prefs-two@example.test',two]] as const){await setDoc(doc(database,`users/${uid}`),profile(uid,email));await updateDoc(doc(a,`users/${uid}`),{active:true,role:'member',revision:2,updatedAt:serverTimestamp()});}
  const filters={audience:'brands',archived:false,view:'list',search:'',scopeFilter:'',statusFilter:'',period:'late',channel:'WP',priority:'Alta',typeFilter:'',teamFilter:'',brandFilter:'',responsibleFilter:'',fromDate:'',toDate:''};
  const value={name:'Mi vista',filters,revision:1,createdAt:serverTimestamp(),updatedAt:serverTimestamp()};const ref=doc(one,'users/prefs-one/views/v1');
  await assertFails(setDoc(ref,value));const b=writeBatch(one);b.set(ref,value);b.update(doc(one,'users/prefs-one'),{preferencesRevision:1,preferencesUpdatedAt:serverTimestamp()});await assertSucceeds(b.commit());await assertSucceeds(getDoc(ref));
  await assertFails(getDoc(doc(two,'users/prefs-one/views/v1')));await assertFails(getDocs(collection(two,'users/prefs-one/views')));await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(),'users/prefs-one/views/v1')));
  const attack=writeBatch(one);attack.update(doc(one,'users/prefs-one'),{role:'superadmin',preferencesRevision:2,preferencesUpdatedAt:serverTimestamp()});attack.set(doc(one,'users/prefs-one/views/v2'),value);await assertFails(attack.commit());
  const invalid=writeBatch(one);invalid.update(doc(one,'users/prefs-one'),{preferencesRevision:2,preferencesUpdatedAt:serverTimestamp()});invalid.update(ref,{filters:{...filters,view:'invalid'},revision:2,updatedAt:serverTimestamp()});await assertFails(invalid.commit());
  const update=writeBatch(one);update.update(doc(one,'users/prefs-one'),{preferencesRevision:2,preferencesUpdatedAt:serverTimestamp()});update.update(ref,{name:'Actualizada',revision:2,updatedAt:serverTimestamp()});await assertSucceeds(update.commit());
  const remove=writeBatch(one);remove.delete(ref);remove.update(doc(one,'users/prefs-one'),{preferencesRevision:3,preferencesUpdatedAt:serverTimestamp()});await assertSucceeds(remove.commit());
});
it('destinatario activo marca solo lectura de avisos de su alcance; no modifica contenido ni avisos ajenos',async()=>{
 const owner=env.authenticatedContext('owner',google('joel.yc23@gmail.com')).firestore(),member=env.authenticatedContext('member',google('member@example.test')).firestore();
 await setDoc(doc(owner,'users/member/access/a__b'),{teamId:'a',brandId:'b'});await setDoc(doc(owner,'teams/a/brands/b'),{archived:false});
 // Earlier cases may revoke the fixture; administrative update restores it.
 let p=await getDoc(doc(owner,'users/member'));if(!p.exists()){await setDoc(doc(member,'users/member'),profile('member','member@example.test'));p=await getDoc(doc(owner,'users/member'));}await updateDoc(doc(owner,'users/member'),{active:true,role:'member',revision:p.data()!.revision+1,updatedAt:serverTimestamp()});
 for(const [uid,id,brand] of [['member','own','b'],['owner','other','b'],['member','foreign','c']])await setDoc(doc(owner,`notifications/${uid}/items/${id}`),{type:'mention',actorUid:'owner',teamId:'a',brandId:brand,orderId:'x',read:false,createdAt:serverTimestamp()});
 await assertSucceeds(updateDoc(doc(member,'notifications/member/items/own'),{read:true,readAt:serverTimestamp()}));
 await assertFails(updateDoc(doc(member,'notifications/member/items/own'),{read:true,orderId:'forged',readAt:serverTimestamp()}));await assertFails(updateDoc(doc(member,'notifications/member/items/own'),{read:false,readAt:serverTimestamp()}));await assertFails(updateDoc(doc(member,'notifications/owner/items/other'),{read:true,readAt:serverTimestamp()}));await assertFails(updateDoc(doc(member,'notifications/member/items/foreign'),{read:true,readAt:serverTimestamp()}));await assertFails(setDoc(doc(member,'batchOperations/fake'),{actorUid:'member',createdAt:serverTimestamp()}));
 await deleteDoc(doc(owner,'users/member/access/a__b'));await assertFails(getDoc(doc(member,'notifications/member/items/own')));
});

it('seguir exige identidad propia, perfil y guard atómicos; no habilita edición del pedido',async()=>{
 const a=env.authenticatedContext('owner',google('joel.yc23@gmail.com')).firestore(),m=env.authenticatedContext('member',google('member@example.test')).firestore();await setDoc(doc(a,'users/member/access/a__b'),{teamId:'a',brandId:'b'});await setDoc(doc(a,'teams/a/brands/b/orders/follow'),{id:'follow',teamId:'a',brandId:'b',createdBy:'owner',revision:1,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
 const ref=doc(m,'teams/a/brands/b/orders/follow/followers/member');await assertFails(setDoc(ref,{uid:'member',displayName:'Prueba',createdAt:serverTimestamp()}));
 const profile=await getDoc(doc(m,'users/member'));const batch=writeBatch(m);batch.set(ref,{uid:'member',displayName:'Prueba',createdAt:serverTimestamp()});batch.set(doc(m,'teams/a/brands/b/orders/follow/followerGuard/global'),{revision:1,updatedAt:serverTimestamp()});batch.update(doc(m,'users/member'),{preferencesRevision:(profile.data()!.preferencesRevision||0)+1,preferencesUpdatedAt:serverTimestamp()});await assertSucceeds(batch.commit());await assertFails(updateDoc(doc(m,'teams/a/brands/b/orders/follow'),{title:'No autorizado',revision:2,updatedAt:serverTimestamp()}));await assertFails(setDoc(doc(m,'teams/a/brands/b/orders/follow/followers/owner'),{uid:'owner',displayName:'Prueba',createdAt:serverTimestamp()}));await assertFails(setDoc(doc(m,'teams/a/brands/c/orders/x/followerGuard/global'),{revision:1,updatedAt:serverTimestamp()}));
});

it('textos públicos: solo admin, claves conocidas y revisión atómica; no abre datos privados',async()=>{
 const a=env.authenticatedContext('owner',google('joel.yc23@gmail.com')).firestore(),m=env.authenticatedContext('member',google('member@example.test')).firestore(),guest=env.unauthenticatedContext().firestore();
 await assertSucceeds(getDocs(collection(guest,'siteContent/public/texts')));await assertFails(getDocs(collection(guest,'users')));
 const change=(database:typeof a,key:string,text:unknown,revision:number)=>{const b=writeBatch(database);b.set(doc(database,'siteContent/public'),{revision,updatedAt:serverTimestamp()});b.set(doc(database,`siteContent/public/texts/${key}`),{text,revision,updatedAt:serverTimestamp()});return b.commit();};
 await assertFails(change(m,'browser.title','Forjado',1));await assertFails(change(guest,'browser.title','Forjado',1));await assertFails(change(a,'unknown.secret','No permitido',1));await assertFails(change(a,'browser.title',{html:'bad'},1));await assertFails(change(a,'browser.title','x'.repeat(2001),1));await assertFails(setDoc(doc(a,'siteContent/public/texts/browser.title'),{text:'Sin meta',revision:1,updatedAt:serverTimestamp()}));
 await assertSucceeds(change(a,'browser.title','Funka personalizado',1));await assertSucceeds(getDoc(doc(guest,'siteContent/public/texts/browser.title')));await assertFails(change(a,'browser.title','Obsoleto',1));await assertFails(deleteDoc(doc(a,'siteContent/public/texts/browser.title')));
 const remove=writeBatch(a);remove.delete(doc(a,'siteContent/public/texts/browser.title'));remove.set(doc(a,'siteContent/public'),{revision:2,updatedAt:serverTimestamp()});await assertSucceeds(remove.commit());await assertSucceeds(change(a,'browser.title','Recreado',3));
});
it('campañas privadas: solo admin revisa con versión, destino y origen protegido',async()=>{
 const original={title:'Campaña',start:'2026-10-01',end:'2026-10-10',channels:[],teamId:null,brandId:null,reviewed:false,revision:1,sourceSha256:'a'.repeat(64),source:{sheet:'CONVERSE',range:'D8:F8',title:'Original'},createdAt:serverTimestamp(),updatedAt:serverTimestamp()};
 await env.withSecurityRulesDisabled(async ctx=>{await setDoc(doc(ctx.firestore(),'campaignDrafts/test'),original);});
 const a=env.authenticatedContext('owner',google('joel.yc23@gmail.com')).firestore(),m=env.authenticatedContext('member',google('member@example.test')).firestore(),guest=env.unauthenticatedContext().firestore();
 await assertFails(getDocs(collection(guest,'campaignDrafts')));await assertFails(getDoc(doc(m,'campaignDrafts/test')));await assertSucceeds(getDoc(doc(a,'campaignDrafts/test')));
 const valid={title:'Corregida',start:'2026-10-01',end:'2026-10-10',channels:['WP'],teamId:'a',brandId:'b',reviewed:true,revision:2,updatedAt:serverTimestamp()};
 await assertFails(updateDoc(doc(m,'campaignDrafts/test'),valid));await assertFails(updateDoc(doc(a,'campaignDrafts/test'),{...valid,channels:['Inventado']}));await assertFails(updateDoc(doc(a,'campaignDrafts/test'),{...valid,channels:['WP','WP']}));await assertFails(updateDoc(doc(a,'campaignDrafts/test'),{...valid,end:'2026-09-30'}));await assertFails(updateDoc(doc(a,'campaignDrafts/test'),{...valid,brandId:'missing'}));await assertFails(updateDoc(doc(a,'campaignDrafts/test'),{...valid,source:{sheet:'Falsificada'}}));await assertFails(updateDoc(doc(a,'campaignDrafts/test'),{...valid,channels:[]}));await assertSucceeds(updateDoc(doc(a,'campaignDrafts/test'),valid));await assertFails(updateDoc(doc(a,'campaignDrafts/test'),valid));await assertFails(deleteDoc(doc(a,'campaignDrafts/test')));
});
it('vínculos de campaña solo admin, actor propio y canal/destino revisados',async()=>{
 const a=env.authenticatedContext('owner',google('joel.yc23@gmail.com')).firestore(),m=env.authenticatedContext('member',google('member@example.test')).firestore();await env.withSecurityRulesDisabled(async ctx=>{await setDoc(doc(ctx.firestore(),'teams/a/brands/b/orders/campaign-rule'),{channel:'WP'});});const link={teamId:'a',brandId:'b',orderId:'campaign-rule',mode:'linked',campaignRevision:2,actorUid:'owner',createdAt:serverTimestamp()};await assertFails(setDoc(doc(m,'campaignDrafts/test/orders/WP'),link));await assertFails(setDoc(doc(a,'campaignDrafts/test/orders/SIS'),link));await assertFails(setDoc(doc(a,'campaignDrafts/test/orders/WP'),{...link,actorUid:'member'}));await assertFails(setDoc(doc(a,'campaignDrafts/test/orders/WP'),{...link,orderId:'missing'}));await assertSucceeds(setDoc(doc(a,'campaignDrafts/test/orders/WP'),link));await assertFails(setDoc(doc(a,'campaignDrafts/test/orders/WP'),link));await assertFails(getDoc(doc(m,'campaignDrafts/test/orders/WP')));
});

it('solo el propietario Google administra, aunque otro perfil tenga rol superadmin',async()=>{
 await env.withSecurityRulesDisabled(async c=>{await setDoc(doc(c.firestore(),'users/other-admin'),{...profile('other-admin','other-admin@example.test',true),active:true});});
 const other=env.authenticatedContext('other-admin',google('other-admin@example.test')).firestore();
 await assertFails(getDocs(collection(other,'users')));await assertFails(getDocs(collection(other,'invitations')));await assertFails(getDocs(collection(other,'adminActivity')));
 await assertFails(setDoc(doc(other,'teams/no-admin'),{name:'No autorizado'}));
 const owner=env.authenticatedContext('owner',google('joel.yc23@gmail.com')).firestore();await assertFails(updateDoc(doc(owner,'users/other-admin'),{role:'superadmin',revision:2,updatedAt:serverTimestamp()}));
});
it('el tamaño del logo está acotado y el historial administrativo no se reescribe',async()=>{
 const owner=env.authenticatedContext('owner',google('joel.yc23@gmail.com')).firestore(),ref=doc(owner,'branding/public'),old=(await getDoc(ref)).data()!;
 await assertSucceeds(setDoc(ref,{logoData:old.logoData,symbolData:old.symbolData,headerWidth:140,revision:old.revision+1,updatedAt:serverTimestamp()}));
 for(const headerWidth of [99,281,180.5])await assertFails(setDoc(ref,{logoData:old.logoData,symbolData:old.symbolData,headerWidth,revision:old.revision+2,updatedAt:serverTimestamp()}));
 const audit=doc(owner,'adminActivity/immutable-new');await setDoc(audit,{action:'test',actorUid:'owner',createdAt:serverTimestamp()});await assertFails(updateDoc(audit,{action:'changed'}));await assertFails(deleteDoc(audit));
});

it('acciones personales conservan actor y prueba del cambio, sin permitir falsificar a otra persona',async()=>{
 await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'users/personal'),{...profile('personal','personal@example.test'),active:true,role:'member'}));
 const db=env.authenticatedContext('personal',google('personal@example.test')).firestore(),owner=env.authenticatedContext('owner',google('joel.yc23@gmail.com')).firestore();
 const event={action:'access',actorUid:'personal',actorEmail:'personal@example.test',createdAt:serverTimestamp()};await assertSucceeds(setDoc(doc(db,'adminActivity/personal-access'),event));
 await assertFails(setDoc(doc(db,'adminActivity/forged-owner'),{...event,actorUid:'owner'}));await assertFails(setDoc(doc(db,'adminActivity/forged-email'),{...event,actorEmail:'joel.yc23@gmail.com'}));await assertFails(setDoc(doc(db,'adminActivity/fake-view'),{...event,action:'viewSaved',targetId:'v'}));
 const batch=writeBatch(db);batch.update(doc(db,'users/personal'),{preferencesRevision:1,preferencesUpdatedAt:serverTimestamp()});batch.set(doc(db,'users/personal/views/v'),{name:'Pendientes',revision:1,createdAt:serverTimestamp(),updatedAt:serverTimestamp(),filters:{audience:'brands',archived:false,view:'board',search:'',scopeFilter:'',statusFilter:'Esperando material',period:'',channel:'',priority:'Media',typeFilter:'',teamFilter:'',brandFilter:'',responsibleFilter:'',fromDate:'',toDate:''}});batch.set(doc(db,'adminActivity/personal-view'),{...event,action:'viewSaved',targetId:'v'});await assertSucceeds(batch.commit());
 await assertFails(getDocs(collection(db,'adminActivity')));await assertFails(deleteDoc(doc(owner,'adminActivity/personal-access')));await assertFails(updateDoc(doc(owner,'adminActivity/personal-access'),{actorUid:'owner'}));
});

it('cada identidad confirma su recibo de ingreso sin poder leer ni reescribir el historial ajeno',async()=>{
 const db=env.authenticatedContext('personal',google('personal@example.test')).firestore();
 const ref=doc(db,'adminActivity/access-personal__receipt');await assertSucceeds(getDoc(ref));
 await assertSucceeds(setDoc(ref,{action:'access',actorUid:'personal',actorEmail:'personal@example.test',createdAt:serverTimestamp()}));
 await assertSucceeds(getDoc(ref));await assertFails(setDoc(ref,{action:'access',actorUid:'personal',actorEmail:'personal@example.test',createdAt:serverTimestamp()}));
 await assertFails(deleteDoc(ref));await assertFails(getDoc(doc(db,'adminActivity/access-owner__receipt')));await assertFails(getDocs(collection(db,'adminActivity')));
});
