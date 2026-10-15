import { test, expect } from '@playwright/test';
import { login } from '../e2e/helpers';
test('transacciones Spark: concurrencia, entrega explícita e idempotencia',async({page})=>{
  test.setTimeout(90000);await login(page,'joel.yc23@gmail.com');
  const result=await page.evaluate(async()=>{
    const api=await import('/src/lib/orders.ts');const store=await import('/src/spark/store.ts');
    const scope={teamId:'spark-race-team',brandId:'spark-race-brand'};
    const races=await Promise.allSettled([0,1].map(()=>api.call('createScope',{...scope,teamName:'Equipo concurrencia',brandName:'Marca concurrencia'})));
    const create={...scope,title:'Pedido de concurrencia',requestId:'spark-race-order'};
    await Promise.all([api.call('createOrder',create),api.call('createOrder',create)]);
    const base={...scope,orderId:create.requestId};
    let blocked=false;try{await api.call('mutateOrder',{...base,revision:1,operationId:'too-early',action:{kind:'deliver'}});}catch{blocked=true;}
    const edits=await Promise.allSettled([0,1].map(i=>api.call('mutateOrder',{...base,revision:1,operationId:`comment-race-${i}`,action:{kind:'comment',body:`Comentario ${i}`}})));
    await api.call('mutateOrder',{...base,revision:2,operationId:'race-delivery',action:{kind:'delivery',url:'https://mega.nz/file/race#full'}});
    const delivery={...base,revision:3,operationId:'race-deliver',action:{kind:'deliver'}};
    await api.call('mutateOrder',delivery);await api.call('mutateOrder',delivery);
    const scopeCount=await store.getFirestore().runTransaction(tx=>tx.get(store.getFirestore().collection('scopes').where('teamId','==',scope.teamId).where('brandId','==',scope.brandId)));
    const order=await store.getFirestore().runTransaction(tx=>tx.get(store.getFirestore().doc(`teams/${scope.teamId}/brands/${scope.brandId}/orders/${create.requestId}`)));
    return {createdScopes:scopeCount.size,requests:races.filter(r=>r.status==='fulfilled').length,edits:edits.filter(r=>r.status==='fulfilled').length,blocked,revision:order.data().revision,status:order.data().status,url:order.data().deliveryUrl};
  });
  expect(result).toEqual({createdScopes:1,requests:2,edits:1,blocked:true,revision:4,status:'Entregado',url:'https://mega.nz/file/race#full'});
});
