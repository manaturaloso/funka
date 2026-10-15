import {test,expect} from '@playwright/test';
import {login} from '../e2e/helpers';
test.beforeAll(async()=>{const r=await fetch('http://127.0.0.1:8080/emulator/v1/projects/demo-funka/databases/(default)/documents',{method:'DELETE'});expect(r.ok).toBe(true);});
for(const width of [1280,390])test(`tablero ajustado y tres estados rápidos ${width}`,async({page})=>{
 test.setTimeout(90000);await page.setViewportSize({width,height:900});await login(page,'joel.yc23@gmail.com');await expect(page.getByRole('button',{name:'Nuevo pedido',exact:true})).toBeVisible();
 const scope={teamId:'board-'+width,brandId:'board-brand-'+width};
 await page.evaluate(async scope=>{const {call}=await import('/src/lib/orders.ts');await call('createScope',{...scope,teamName:'Equipo tablero',brandName:'Marca tablero'});for(let i=0;i<9;i++)await call('createOrder',{...scope,requestId:crypto.randomUUID(),title:`Tarjeta ${i}`,type:'POP',priority:'Media',status:i===0?'Esperando material':'Pendiente'});},scope);await page.reload();await page.locator('.filters').first().locator('select').first().selectOption(`${scope.teamId}__${scope.brandId}`);
 const card=page.locator('.order-card').filter({has:page.getByRole('button',{name:'Tarjeta 0',exact:true})});await expect(card).toBeVisible();await expect(card.locator('select')).toHaveCount(0);await expect(card.locator('.order-quick-states button')).toHaveText(['Pendiente','En proceso','Entregado']);await expect(card.locator('.order-current-state')).toHaveText('Esperando material');
 const dimensions=await page.locator('.board-column').evaluateAll(columns=>columns.map(c=>({count:c.querySelectorAll('.order-card').length,height:c.getBoundingClientRect().height,scroll:c.querySelector('.board-cards')!.scrollHeight,client:c.querySelector('.board-cards')!.clientHeight})));
 expect(dimensions.some(c=>c.count===0&&c.height<120)).toBe(true);const long=dimensions.find(c=>c.count===8)!;expect(long.height).toBeLessThanOrEqual(650);expect(long.scroll).toBeGreaterThan(long.client);
 await card.getByRole('button',{name:'En proceso',exact:true}).click();await expect(card.locator('.order-current-state')).toHaveText('En proceso');await card.getByRole('button',{name:'Tarjeta 0',exact:true}).click();const detail=page.getByRole('dialog');await expect(detail.getByLabel('Estado',{exact:true}).locator('option')).toContainText(['Esperando material','Por validar','En pausa','Por subir']);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
