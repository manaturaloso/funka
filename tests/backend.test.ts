import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, GoogleAuthProvider, signInWithCredential, signOut } from 'firebase/auth';
import { getFunctions, connectFunctionsEmulator, httpsCallable } from 'firebase/functions';
import { initializeApp as initializeAdmin, deleteApp as deleteAdmin } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) throw new Error('Ejecuta estas pruebas únicamente mediante Firebase Emulator Suite.');
const projectId = 'demo-funka';
const app = initializeApp({projectId,apiKey:'demo-key'},'backend-test');
const auth = getAuth(app);
const functions = getFunctions(app,'us-central1');
connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});
connectFunctionsEmulator(functions,'127.0.0.1',5001);
const admin = initializeAdmin({projectId},'test-admin');
const db = getFirestore(admin);
async function google(email: string, sub: string, verified = true) {
  await signOut(auth);
  const encode = (obj: object) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const jwt = `${encode({alg:'none',typ:'JWT'})}.${encode({sub,email,email_verified:verified,iss:'https://accounts.google.com',aud:projectId,iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+3600})}.`;
  return (await signInWithCredential(auth,GoogleAuthProvider.credential(jwt))).user;
}
beforeAll(async () => {
  for (const collection of await db.listCollections()) await db.recursiveDelete(collection);
});
afterAll(async () => {await deleteApp(app); await deleteAdmin(admin);});
describe('Funciones de acceso reales', () => {
  it('rechaza invocaciones sin autenticación', async () => {
    await expect(httpsCallable(functions,'establishAccess')({})).rejects.toMatchObject({code:'functions/unauthenticated'});
  });
  it('un usuario Google no autorizado queda pendiente y no puede autorizar usuarios', async () => {
    const user = await google('member@example.test','member-real');
    await httpsCallable(functions,'establishAccess')({});
    expect((await db.doc(`users/${user.uid}`).get()).data()).toMatchObject({active:false,role:'pending',scopes:[]});
    await expect(httpsCallable(functions,'authorizeEmail')({email:'other@example.test',scopes:[]})).rejects.toMatchObject({code:'functions/permission-denied'});
  });
  it('asigna el superadmin en servidor y vincula el UID', async () => {
    const user = await google('joel.yc23@gmail.com','joel-real');
    await httpsCallable(functions,'establishAccess')({});
    expect((await db.doc(`users/${user.uid}`).get()).data()).toMatchObject({role:'superadmin',active:true});
    expect((await db.doc('system/bootstrap').get()).data()!.uid).toBe(user.uid);
    await httpsCallable(functions,'establishAccess')({});
    expect((await db.doc('system/bootstrap').get()).data()!.uid).toBe(user.uid);
  });
  it('una autorización válida concede únicamente sus combinaciones', async () => {
    await db.doc('teams/team-a/brands/cat').set({archived:false});
    await httpsCallable(functions,'authorizeEmail')({email:'invited@example.test',scopes:[{teamId:'team-a',brandId:'cat'}]});
    const user = await google('invited@example.test','invited-real');
    await httpsCallable(functions,'establishAccess')({});
    expect((await db.doc(`users/${user.uid}`).get()).data()).toMatchObject({active:true,role:'member'});
    expect((await db.doc(`users/${user.uid}/access/team-a__cat`).get()).exists).toBe(true);
    expect((await db.doc(`users/${user.uid}/access/team-a__fila`).get()).exists).toBe(false);
  });
  it('iniciar sesión no reactiva un usuario desactivado', async () => {
    const user = auth.currentUser!;
    await db.doc(`users/${user.uid}`).update({active:false});
    await httpsCallable(functions,'establishAccess')({});
    expect((await db.doc(`users/${user.uid}`).get()).data()!.active).toBe(false);
  });
});


describe('Pedidos colaborativos',()=>{
  let scope={teamId:'creative',brandId:'cat'};
  let orderId='order-roundtrip';
  let uid='';
  const invoke=(name:string,data:unknown)=>httpsCallable(functions,name)(data);
  const ref=()=>db.doc(`teams/${scope.teamId}/brands/${scope.brandId}/orders/${orderId}`);
  const mutate=async(action:unknown,revision?:number,operationId=crypto.randomUUID())=>invoke('mutateOrder',{...scope,orderId,revision:revision??(await ref().get()).data()!.revision,operationId,action});
  it('crea alcance y pedido rápido idempotente sin exigir canal',async()=>{
    const user=await google('joel.yc23@gmail.com','joel-real');uid=user.uid;
    await invoke('createScope',{...scope,teamName:'Equipo creativo',brandName:'CAT'});
    const payload={...scope,requestId:orderId,title:'Campaña de octubre'};
    await invoke('createOrder',payload);await invoke('createOrder',payload);
    expect((await ref().get()).data()).toMatchObject({channel:null,status:'Por asignar',revision:1,pieces:[]});
    expect((await ref().collection('activity').get()).size).toBe(1);
  });
  it('deniega accesos directos, asignaciones ajenas y edición con revisión antigua',async()=>{
    const outsider=await google('outsider@example.test','outsider-orders');
    await invoke('establishAccess',{});
    await expect(invoke('createOrder',{...scope,requestId:'forbidden',title:'No'})).rejects.toMatchObject({code:'functions/permission-denied'});
    await expect(invoke('listMembers',scope)).rejects.toMatchObject({code:'functions/permission-denied'});
    await google('joel.yc23@gmail.com','joel-real');
    const fields={title:'Campaña actualizada',description:'Brief',type:'Campaña',channel:'WP',priority:'Alta',assigneeUid:uid,collaborators:[],deadline:'2026-10-18T22:00:00.000Z'};
    await expect(mutate({kind:'edit',fields:{...fields,assigneeUid:outsider.uid}})).rejects.toMatchObject({code:'functions/permission-denied'});
    await mutate({kind:'edit',fields},1);
    await expect(mutate({kind:'edit',fields:{...fields,title:'Cambio obsoleto'}},1)).rejects.toMatchObject({code:'functions/aborted'});
    expect((await ref().get()).data()!.title).toBe('Campaña actualizada');
    expect((await ref().get()).data()!.deckWarning).toBe(true);
  });
  it('persiste pieza, responsable, comentarios y enlaces completos sin entregar automáticamente',async()=>{
    const piece={id:'banner',name:'Banner',quantity:1,measures:'1200x600',format:'PNG',specs:'Logo',references:[],group:'Web',order:0,required:true,assigneeUid:uid,deadline:null,state:'Pendiente',reason:'',deliveryUrl:null};
    await mutate({kind:'piece',piece});
    await expect(mutate({kind:'deliver'})).rejects.toMatchObject({code:'functions/failed-precondition'});
    await mutate({kind:'piece',piece:{...piece,state:'Lista'}});
    expect((await ref().get()).data()!.status).toBe('Por asignar');
    await mutate({kind:'comment',body:'Pieza lista para revisar',pieceId:'banner'});
    const url='https://mega.nz/file/test-file#COMPLETE-private-fragment';
    await mutate({kind:'delivery',url,pieceId:'banner'});
    expect((await ref().get()).data()!.pieces[0]).toMatchObject({assigneeUid:uid,state:'Lista',deliveryUrl:url});
    expect((await ref().collection('comments').get()).docs[0].data().pieceId).toBe('banner');
    expect((await ref().collection('deliveries').get()).docs[0].data().url).toBe(url);
    await mutate({kind:'deliver'});
    expect((await ref().get()).data()!.status).toBe('Entregado');
  });
  it('reabre, revisa, archiva y recupera sin borrar historial ni versiones; reintentos no duplican',async()=>{
    await mutate({kind:'review',result:'Requiere ajustes',reason:'Ajustar logo'});
    expect((await ref().get()).data()!.status).toBe('En proceso');
    await mutate({kind:'archive',archived:true});
    await expect(mutate({kind:'comment',body:'No permitido'})).rejects.toMatchObject({code:'functions/failed-precondition'});
    await mutate({kind:'archive',archived:false});
    const revision=(await ref().get()).data()!.revision;
    const operationId='retry-comment';
    await mutate({kind:'comment',body:'Ajustes solicitados'},revision,operationId);
    await mutate({kind:'comment',body:'Ajustes solicitados'},revision,operationId);
    expect((await ref().collection('comments').get()).size).toBe(2);
    expect((await ref().collection('deliveries').get()).size).toBe(1);
    expect((await ref().get()).data()!.pieces[0].deliveryUrl).toContain('#COMPLETE-private-fragment');
  });
  it('todos los miembros autorizados colaboran aunque no sean responsables',async()=>{
    await google('joel.yc23@gmail.com','joel-real');
    await invoke('authorizeEmail',{email:'collaborator@example.test',scopes:[scope]});
    await google('collaborator@example.test','collaborator-real');
    await invoke('establishAccess',{});
    const scopes=(await invoke('listScopes',{})).data as unknown[];
    expect(scopes).toHaveLength(1);
    await mutate({kind:'status',status:'Pendiente'});
    await mutate({kind:'comment',body:'Colaboración sin ser responsable',mentionedUids:[uid]});
    expect((await db.collection(`notifications/${uid}/items`).get()).size).toBe(1);
    await db.doc('users/no-access-mention').set({active:true,role:'member',displayName:'No autorizado'});
    await expect(mutate({kind:'comment',body:'No puede ver el pedido',mentionedUids:['no-access-mention']})).rejects.toMatchObject({code:'functions/permission-denied'});
    expect((await ref().get()).data()!.status).toBe('Pendiente');
    await expect(invoke('createScope',{teamId:'denied',brandId:'cat',teamName:'No',brandName:'No'})).rejects.toMatchObject({code:'functions/permission-denied'});
  });

});
