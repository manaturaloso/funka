import {test,expect} from '@playwright/test';
import {login} from '../e2e/helpers';
test.beforeAll(async()=>{const r=await fetch('http://127.0.0.1:8080/emulator/v1/projects/demo-funka/databases/(default)/documents',{method:'DELETE'});expect(r.ok).toBe(true);});
test('dos integrantes colaboran, conservan historial y pierden acceso al revocarlo',async({page,browser})=>{
 test.setTimeout(150000);
 await login(page,'joel.yc23@gmail.com');await expect(page.getByRole('button',{name:'Administración',exact:true})).toBeVisible();
 const scope={teamId:'shared-team',brandId:'shared-brand'};
 await page.evaluate(async scope=>{const {call}=await import('/src/lib/orders.ts');await call('createScope',{...scope,teamName:'Equipo compartido',brandName:'Marca compartida'});for(const email of ['editor-one@example.test','editor-two@example.test','brand-viewer@example.test'])await call('saveInvitation',{email,active:true,revision:0,teamIds:[scope.teamId],scopes:[scope]});},scope);
 const context=await browser.newContext({baseURL:'http://127.0.0.1:5173'}),one=await context.newPage();
 const context2=await browser.newContext({baseURL:'http://127.0.0.1:5173'}),two=await context2.newPage();
 await login(one,'editor-one@example.test');await expect(one.getByRole('button',{name:'Nuevo pedido',exact:true})).toBeVisible();await expect(one.getByRole('button',{name:'Administración',exact:true})).toHaveCount(0);
 await login(two,'editor-two@example.test');await expect(two.getByRole('button',{name:'Nuevo pedido',exact:true})).toBeVisible();
 const firstUid=await one.evaluate(async()=>{const {auth}=await import('/src/lib/firebase.ts');return auth!.currentUser!.uid;});
 const secondUid=await two.evaluate(async()=>{const {auth}=await import('/src/lib/firebase.ts');return auth!.currentUser!.uid;});
 await one.getByRole('button',{name:'Nuevo pedido',exact:true}).click();const dialog=one.getByRole('dialog');await dialog.getByLabel('Marca',{exact:true}).selectOption(scope.brandId);await dialog.locator(`input[name=assignees][value="${firstUid}"]`).check();await dialog.locator(`input[name=assignees][value="${secondUid}"]`).check();await expect(dialog.locator('[name=deliveryUrl]')).toHaveCount(0);await dialog.getByLabel('Campaña',{exact:true}).fill('Colaboración real');await dialog.getByRole('button',{name:'Crear pedido',exact:true}).click();await expect(dialog.getByRole('heading',{name:'POP · Colaboración real',exact:true})).toBeVisible();await expect(dialog.getByRole('button',{name:'Guardar detalles',exact:true})).toBeEnabled();await expect(dialog.getByRole('button',{name:'Eliminar pedido',exact:true})).toHaveCount(0);
 const thirdContext=await browser.newContext({baseURL:'http://127.0.0.1:5173'}),third=await thirdContext.newPage();await login(third,'brand-viewer@example.test');await expect(third.getByRole('heading',{name:'Mis pedidos',exact:true})).toBeVisible();await expect(third.getByRole('button',{name:'POP · Colaboración real',exact:true})).toBeVisible();await expect(third.getByRole('button',{name:'Administración',exact:true})).toHaveCount(0);
 const id=await one.evaluate(async scope=>{const {call}=await import('/src/lib/orders.ts');return (await call<any>('listScopedOrders',scope)).orders[0].id;},scope);
 await two.goto(`/#orders/${scope.teamId}/${scope.brandId}/${id}`);await expect(two.getByRole('dialog')).toBeVisible();await two.getByRole('dialog').getByLabel('Campaña',{exact:true}).fill('Editada por otra persona');await two.getByRole('dialog').getByRole('button',{name:'Guardar detalles',exact:true}).click();await expect.poll(()=>two.evaluate(async s=>{const {call}=await import('/src/lib/orders.ts');return (await call<any>('listScopedOrders',s)).orders[0].revision;},scope)).toBe(2);
 const result=await one.evaluate(async ({scope,id,secondUid})=>{
  const {call}=await import('/src/lib/orders.ts'),store=await import('/src/spark/store.ts');
  const base={...scope,orderId:id};let revision=2;
  const mutate=async(action:unknown)=>{await call('mutateOrder',{...base,revision,operationId:crypto.randomUUID(),action});revision++;};
  let stale=false;try{await call('mutateOrder',{...base,revision:1,operationId:crypto.randomUUID(),action:{kind:'status',status:'En proceso'}});}catch(e){stale=String(e).includes('Otra persona');}
  const piece={id:crypto.randomUUID(),name:'Pieza colaborativa',quantity:1,measures:'1080×1080',format:'PNG',specs:'Pieza de prueba',references:[],group:'',order:0,required:true,assigneeUid:secondUid,deadline:null,state:'Pendiente',reason:'',deliveryUrl:null};
  await mutate({kind:'piece',piece});await mutate({kind:'piece',piece:{...piece,state:'Lista'}});
  await mutate({kind:'comment',body:'Comentario de colaboración',mentionedUids:[secondUid]});
  await mutate({kind:'status',status:'Por validar'});await mutate({kind:'delivery',url:'https://mega.nz/folder/demo#clave-completa'});await mutate({kind:'deliver'});await mutate({kind:'review',result:'Requiere ajustes',reason:'Ajustar tamaño'});await mutate({kind:'review',result:'Aprobado',reason:''}).catch(()=>{});
  // Reopen, review again and archive/restore, all as a member.
  await mutate({kind:'status',status:'Por validar'});await mutate({kind:'review',result:'Aprobado',reason:''});await mutate({kind:'archive',archived:true});await mutate({kind:'archive',archived:false});
  const db=store.getFirestore(),path=`teams/${scope.teamId}/brands/${scope.brandId}/orders/${id}`;
  const order=(await db.runTransaction(tx=>tx.get(db.doc(path)))).data();const activities=await db.runTransaction(tx=>tx.get(db.collection(path+'/activity')));const deliveries=await db.runTransaction(tx=>tx.get(db.collection(path+'/deliveries')));
  let noAdmin=false;try{await call('listAdmin',{section:'users'});}catch{noAdmin=true;}
  let otherScope=false;try{await call('createOrder',{teamId:'no-access',brandId:'no-access',requestId:crypto.randomUUID(),title:'No autorizado'});}catch{otherScope=true;}
  return {stale,noAdmin,otherScope,order,activities:activities.size,deliveries:deliveries.docs.map(d=>d.data().url)};
 },{scope,id,secondUid});
 expect(result.stale).toBe(true);expect(result.noAdmin).toBe(true);expect(result.otherScope).toBe(true);expect(result.order).toMatchObject({revision:13,review:'Aprobado',archived:false,campaignName:'Editada por otra persona',assigneeUid:firstUid,collaborators:[secondUid]});expect(result.activities).toBe(13);expect(result.deliveries).toEqual(['https://mega.nz/folder/demo#clave-completa']);
 const audits=await page.evaluate(async()=>{const {call}=await import('/src/lib/orders.ts');return (await call<any>('listAdmin',{section:'adminActivity'})).records.filter(r=>r.id.startsWith('collab-'));});expect(audits).toHaveLength(13);expect(audits.every(a=>a.before===null||a.before.revision===a.after.revision-1)).toBe(true);
 await page.getByRole('button',{name:'Administración',exact:true}).click();const person=page.locator('.admin-row').filter({hasText:'editor-two@example.test'});await expect(person.getByRole('button',{name:'Editar accesos',exact:true})).toBeVisible();await expect(person.getByRole('button',{name:'Eliminar',exact:true})).toBeVisible();await expect(person.getByText('Más acciones',{exact:true})).toHaveCount(0);
 await page.evaluate(async ({scope,uid})=>{const {call}=await import('/src/lib/orders.ts');await call('saveMember',{uid,revision:1,role:'member',active:true,teamIds:[],scopes:[]});},{scope,uid:secondUid});
 const revoked=await two.evaluate(async({scope,id})=>{const {call}=await import('/src/lib/orders.ts');try{await call('mutateOrder',{...scope,orderId:id,revision:13,operationId:crypto.randomUUID(),action:{kind:'comment',body:'Prohibido'}});return false;}catch{return true;}},{scope,id});expect(revoked).toBe(true);
 await context.close();await context2.close();await thirdContext.close();
});
