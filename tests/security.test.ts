import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, it } from 'vitest';
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
const claims=(uid:string)=>({email:uid+'@example.test',email_verified:true,firebase:{sign_in_provider:'google.com'}});
let env: RulesTestEnvironment;
beforeAll(async () => {
  env = await initializeTestEnvironment({projectId:'demo-funka',firestore:{host:'127.0.0.1',port:8080,rules:readFileSync('firestore.rules','utf8')}});
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    for (const [id,data] of Object.entries({
      'teams/team-a/brands/cat':{archived:false},
      'teams/team-b/brands/fila':{archived:false},
      'teams/team-a/brands/archived':{archived:true},
      'teams/team-a/brands/archived/orders/old':{title:'Conservado'},
      'users/member/access/team-a__archived':{teamId:'team-a',brandId:'archived'},
      'users/admin':{active:true,role:'superadmin'},
      'users/member':{active:true,role:'member'},
      'users/pending':{active:false,role:'pending'},
      'users/disabled':{active:false,role:'member'},
      'users/member/access/team-a__cat':{teamId:'team-a',brandId:'cat'},
      'users/member/access/team-b__fila':{teamId:'team-b',brandId:'fila'},
      'users/disabled/access/team-a__cat':{teamId:'team-a',brandId:'cat'},
      'teams/team-a/brands/cat/orders/order-1':{title:'Pedido'},
      'teams/team-a/brands/cat/orders/order-1/comments/comment-1':{body:'Privado'},
      'teams/team-a/brands/cat/orders/order-1/deliveries/version-1':{url:'https://mega.nz/file/test#secret'},
      'teams/team-b/brands/fila/orders/order-2':{title:'Otro equipo'},
      'teams/team-a/brands/fila/orders/hidden':{title:'No autorizado'},
      'notifications/member/items/hidden':{teamId:'team-a',brandId:'fila'},
    })) await setDoc(doc(db,id),data);
  });
});
afterAll(async () => {await env.cleanup();});
describe('Reglas de acceso', () => {
  it('rechaza usuarios anónimos, pendientes y desactivados', async () => {
    for (const context of [env.unauthenticatedContext(),env.authenticatedContext('pending',claims('pending')),env.authenticatedContext('disabled',claims('disabled'))])
      await assertFails(getDoc(doc(context.firestore(),'teams/team-a/brands/cat/orders/order-1')));
  });
  it('permite consultar pedidos en dos combinaciones autorizadas', async () => {
    const db = env.authenticatedContext('member',claims('member')).firestore();
    await assertSucceeds(getDocs(collection(db,'teams/team-a/brands/cat/orders')));
    await assertSucceeds(getDocs(collection(db,'teams/team-b/brands/fila/orders')));
    await assertSucceeds(getDoc(doc(db,'teams/team-a/brands/cat/orders/order-1/comments/comment-1')));
  });
  it('pertenecer a un equipo no concede acceso a otras marcas ni sus registros hijos', async () => {
    const db = env.authenticatedContext('member',claims('member')).firestore();
    for (const path of ['teams/team-a/brands/fila/orders/hidden','teams/team-a/brands/fila/orders/hidden/comments/one','teams/team-a/brands/fila/orders/hidden/deliveries/one','notifications/member/items/hidden']) await assertFails(getDoc(doc(db,path)));
  });
  it('impide autoasignar rol, permisos y modificar historial', async () => {
    const db = env.authenticatedContext('member',claims('member')).firestore();
    await assertFails(setDoc(doc(db,'users/member'),{active:true,role:'superadmin'}));
    await assertFails(setDoc(doc(db,'users/member/access/team-a__fila'),{}));
    await assertFails(setDoc(doc(db,'teams/team-a/brands/cat/orders/order-1/activity/fake'),{action:'fake'}));
  });
  it('solo permite leer el perfil propio', async () => {
    const db = env.authenticatedContext('member',claims('member')).firestore();
    await assertSucceeds(getDoc(doc(db,'users/member')));
    await assertFails(getDoc(doc(db,'users/disabled')));
  });
  it('archivar una vinculación revoca lecturas aunque el grant siga existiendo',async()=>{
    const db=env.authenticatedContext('member',claims('member')).firestore();
    await assertFails(getDoc(doc(db,'teams/team-a/brands/archived/orders/old')));
    await assertFails(setDoc(doc(db,'teams/team-a/brands/archived'),{archived:false}));
  });
  it('ni superadmin puede reescribir versiones o configuración por el SDK cliente',async()=>{
    const db=env.authenticatedContext('admin',claims('admin')).firestore();
    for(const path of ['decks/deck-wp/versions/1','settings/general','adminActivity/forged','deckPreviews/forged'])await assertFails(setDoc(doc(db,path),{revision:99}));
  });

});
