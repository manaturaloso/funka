import { test,expect } from '@playwright/test';
import { login } from '../e2e/helpers';
for(const width of [1280,390])test(`eliminación de marca en cascada, cancelación y vista obsoleta a ${width}px`,async({page,browser})=>{
  test.setTimeout(120000);await page.setViewportSize({width,height:900});
  const context=await browser.newContext({baseURL:'http://127.0.0.1:5173'});const guest=await context.newPage();await login(guest,`delete-${width}@example.test`);await expect(guest.getByRole('heading',{name:'Acceso pendiente',exact:true})).toBeVisible();await context.close();
  await login(page,'joel.yc23@gmail.com');
  const ids=await page.evaluate(async width=>{
    const api=await import('/src/lib/orders.ts');const store=await import('/src/spark/store.ts');const firebase=await import('/src/lib/firebase.ts');
    const team=`delete-team-${width}`,brand=`delete-brand-${width}`,other=`keep-brand-${width}`,deck=`delete-deck-${width}`;
    await api.call('createScope',{teamId:team,brandId:brand,teamName:`Equipo borrar ${width}`,brandName:`Marca borrar ${width}`});
    await api.call('createScope',{teamId:team,brandId:other,teamName:`Equipo borrar ${width}`,brandName:`Marca conservar ${width}`});
    await api.call('saveDeck',{id:deck,revision:0,brandId:brand,channel:'WP',name:'Deck eliminar',description:'',archived:false,isDefault:true,pieces:[{id:'banner',name:'Banner',quantity:1,measures:'100x100',format:'PNG',specs:'',references:[],group:'',order:0,required:true}]});
    await api.call('createOrder',{teamId:team,brandId:brand,requestId:`delete-order-${width}`,title:`Pedido borrar ${width}`,channel:'WP'});
    await api.call('createOrder',{teamId:team,brandId:other,requestId:`keep-order-${width}`,title:`Pedido conservar ${width}`});
    await api.call('mutateOrder',{teamId:team,brandId:brand,orderId:`delete-order-${width}`,revision:1,operationId:'first-comment',action:{kind:'comment',body:'Comentario que se elimina'}});
    const users=await api.call<{records:{id:string;email:string;revision:number}[]}>('listAdmin',{section:'users'});const user=users.records.find(u=>u.email===`delete-${width}@example.test`)!;
    await api.call('saveMember',{uid:user.id,revision:user.revision,active:true,role:'member',teamIds:[team],scopes:[{teamId:team,brandId:brand},{teamId:team,brandId:other}]});
    await store.getFirestore().runTransaction(async tx=>{tx.create(store.getFirestore().doc(`notifications/${user.id}/items/test-${width}`),{actorUid:firebase.auth!.currentUser!.uid,createdAt:store.FieldValue.serverTimestamp(),teamId:team,brandId:brand,orderId:`delete-order-${width}`,read:false});});
    await api.call('previewDeckApply',{deckId:deck,deckRevision:1,targets:[{teamId:team,brandId:brand,orderId:`delete-order-${width}`,revision:2}]});
    return {team,brand,other,deck,user:user.id};
  },width);
  await page.getByRole('button',{name:'Administración',exact:true}).click();await page.getByLabel('Sección de administración').selectOption({label:'Marcas'});
  const row=page.locator('.admin-row').filter({has:page.getByText(`Marca borrar ${width}`,{exact:true})});if(await row.locator('.record-actions').getAttribute('open')===null)await row.getByText('Más acciones',{exact:true}).click();await row.getByRole('button',{name:'Eliminar',exact:true}).click();
  let dialog=page.getByRole('dialog',{name:'Eliminar definitivamente',exact:true});await expect(dialog.getByText('Pedidos: 1',{exact:true})).toBeVisible();await dialog.getByLabel('Confirmar nombre para eliminar').fill('nombre equivocado');await expect(dialog.getByRole('button',{name:'Eliminar definitivamente',exact:true})).toBeDisabled();await dialog.getByRole('button',{name:'Cancelar',exact:true}).click();await expect(row).toBeVisible();
  if(await row.locator('.record-actions').getAttribute('open')===null)await row.getByText('Más acciones',{exact:true}).click();await row.getByRole('button',{name:'Eliminar',exact:true}).click();await dialog.getByLabel('Confirmar nombre para eliminar').fill(`Marca borrar ${width}`);
  await page.evaluate(async({team,brand})=>{const api=await import('/src/lib/orders.ts');await api.call('mutateOrder',{teamId:team,brandId:brand,orderId:`delete-order-${brand.split('-').at(-1)}`,revision:2,operationId:'new-comment',action:{kind:'comment',body:'Cambio posterior a la vista previa'}});},ids);
  await dialog.getByRole('button',{name:'Eliminar definitivamente',exact:true}).click();await expect(dialog.getByRole('alert')).toContainText('cambiaron');await expect(row).toBeVisible();await dialog.getByRole('button',{name:'Revisar nuevamente'}).click();await dialog.getByLabel('Confirmar nombre para eliminar').fill(`Marca borrar ${width}`);await dialog.getByRole('button',{name:'Eliminar definitivamente',exact:true}).click();await expect(dialog).toBeHidden();await expect(row).toHaveCount(0);
  const result=await page.evaluate(async({team,brand,other,deck,user})=>{
    const store=await import('/src/spark/store.ts');const service=store.getFirestore();return service.runTransaction(async tx=>{
      const paths=[`brands/${brand}`,`teams/${team}/brands/${brand}`,`teams/${team}/brands/${brand}/orders/delete-order-${brand.split('-').at(-1)}`,`decks/${deck}`,`decks/${deck}/versions/1`,`users/${user}/access/${team}__${brand}`,`notifications/${user}/items/test-${brand.split('-').at(-1)}`];
      const removed=await Promise.all(paths.map(p=>tx.get(service.doc(p))));const retained=await tx.get(service.doc(`teams/${team}/brands/${other}/orders/keep-order-${brand.split('-').at(-1)}`));const profile=await tx.get(service.doc(`users/${user}`));const previews=await tx.get(service.collection('deckPreviews').where('deck.id','==',deck));return {removed:removed.every(r=>!r.exists),retained:retained.exists,scopes:profile.data().scopes,previews:previews.size};
    });
  },ids);
  expect(result).toEqual({removed:true,retained:true,scopes:[{teamId:ids.team,brandId:ids.other}],previews:0});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('elimina deck, pedido y perfil; mantiene dueño y reintento idempotente',async({page,browser})=>{
  test.setTimeout(90000);
  const context=await browser.newContext({baseURL:'http://127.0.0.1:5173'});const guest=await context.newPage();await login(guest,'delete-profile@example.test');await expect(guest.getByRole('heading',{name:'Acceso pendiente',exact:true})).toBeVisible();await context.close();await login(page,'joel.yc23@gmail.com');
  const result=await page.evaluate(async()=>{
    const api=await import('/src/lib/orders.ts');const store=await import('/src/spark/store.ts');const fb=await import('/src/lib/firebase.ts');
    await api.call('createScope',{teamId:'delete-extra-team',brandId:'delete-extra-brand',teamName:'Equipo extra',brandName:'Marca extra'});
    await api.call('saveDeck',{id:'delete-extra-deck',revision:0,brandId:'delete-extra-brand',channel:'WP',name:'Deck extra',description:'',archived:false,isDefault:true,pieces:[{id:'banner',name:'Banner',quantity:1,measures:'',format:'',specs:'',references:[],group:'',order:0,required:true}]});
    await api.call('createOrder',{teamId:'delete-extra-team',brandId:'delete-extra-brand',requestId:'delete-extra-order',title:'Pedido extra',channel:'WP'});
    async function remove(selection:unknown){const preview=await api.call<{fingerprint:string;label:string}>('previewDeletion',selection);const payload={...selection as object,fingerprint:preview.fingerprint,confirmation:preview.label,operationId:crypto.randomUUID()};await api.call('deleteRecord',payload);await api.call('deleteRecord',payload);}
    await remove({section:'decks',id:'delete-extra-deck',revision:1});
    const brand=await store.getFirestore().runTransaction(tx=>tx.get(store.getFirestore().doc('brands/delete-extra-brand')));
    const order=await store.getFirestore().runTransaction(tx=>tx.get(store.getFirestore().doc('teams/delete-extra-team/brands/delete-extra-brand/orders/delete-extra-order')));
    await remove({section:'orders',id:'delete-extra-order',teamId:'delete-extra-team',brandId:'delete-extra-brand',revision:1});
    const users=await api.call<{records:{id:string;email:string;revision:number}[]}>('listAdmin',{section:'users'});const profile=users.records.find(r=>r.email==='delete-profile@example.test')!;await remove({section:'users',id:profile.id,revision:profile.revision});
    let ownerProtected=false;const owner=users.records.find(r=>r.id===fb.auth!.currentUser!.uid)!;try{await api.call('previewDeletion',{section:'users',id:owner.id,revision:owner.revision});}catch{ownerProtected=true;}
    return {defaultDeck:brand.data().defaultDecks.WP,snapshot:order.data().deck.id,ownerProtected};
  });expect(result).toEqual({defaultDeck:null,snapshot:'delete-extra-deck',ownerProtected:true});
});
test('eliminar equipo limpia membresías y equipo automático, conserva marca compartida',async({page,browser})=>{
  test.setTimeout(90000);
  const context=await browser.newContext({baseURL:'http://127.0.0.1:5173'});const guest=await context.newPage();await login(guest,'delete-team-member@example.test');await expect(guest.getByRole('heading',{name:'Acceso pendiente',exact:true})).toBeVisible();await context.close();await login(page,'joel.yc23@gmail.com');
  const result=await page.evaluate(async()=>{
    const api=await import('/src/lib/orders.ts');const store=await import('/src/spark/store.ts');
    await api.call('createScope',{teamId:'team-removed',brandId:'shared-brand',teamName:'Equipo eliminado',brandName:'Marca compartida'});
    await api.call('createScope',{teamId:'team-retained',brandId:'shared-brand',teamName:'Equipo conservado',brandName:'Marca compartida'});
    await api.call('saveEntity',{kind:'brands',id:'shared-brand',revision:0,name:'Marca compartida',archived:false,automaticTeamId:'team-removed'});
    await api.call('createOrder',{teamId:'team-removed',brandId:'shared-brand',requestId:'removed-team-order',title:'Pedido eliminado'});
    await api.call('createOrder',{teamId:'team-retained',brandId:'shared-brand',requestId:'retained-team-order',title:'Pedido conservado'});
    const users=await api.call<{records:{id:string;email:string;revision:number}[]}>('listAdmin',{section:'users'});const user=users.records.find(u=>u.email==='delete-team-member@example.test')!;
    await api.call('saveMember',{uid:user.id,revision:user.revision,role:'member',active:true,teamIds:['team-removed','team-retained'],scopes:[{teamId:'team-removed',brandId:'shared-brand'},{teamId:'team-retained',brandId:'shared-brand'}]});
    await api.call('saveInvitation',{email:'team-invitation@example.test',revision:0,active:true,teamIds:['team-removed','team-retained'],scopes:[{teamId:'team-removed',brandId:'shared-brand'},{teamId:'team-retained',brandId:'shared-brand'}]});
    const selected={section:'teams',id:'team-removed',revision:0};const preview=await api.call<{fingerprint:string;label:string}>('previewDeletion',selected);
    await api.call('deleteRecord',{...selected,fingerprint:preview.fingerprint,confirmation:preview.label,operationId:crypto.randomUUID()});
    const service=store.getFirestore();return service.runTransaction(async tx=>{
      const root=await tx.get(service.doc('teams/team-removed'));const order=await tx.get(service.doc('teams/team-removed/brands/shared-brand/orders/removed-team-order'));const brand=await tx.get(service.doc('brands/shared-brand'));const kept=await tx.get(service.doc('teams/team-retained/brands/shared-brand/orders/retained-team-order'));const membership=await tx.get(service.doc(`users/${user.id}/memberships/team-removed`));const profile=await tx.get(service.doc(`users/${user.id}`));const invitation=await tx.get(service.collection('invitations').where('email','==','team-invitation@example.test'));
      return {root:root.exists,order:order.exists,brand:brand.exists,automaticTeam:brand.data().automaticTeamId,kept:kept.exists,membership:membership.exists,teamIds:profile.data().teamIds,scopes:profile.data().scopes,invitedTeams:invitation.docs[0].data().teamIds};
    });
  });expect(result).toEqual({root:false,order:false,brand:true,automaticTeam:null,kept:true,membership:false,teamIds:['team-retained'],scopes:[{teamId:'team-retained',brandId:'shared-brand'}],invitedTeams:['team-retained']});
});
