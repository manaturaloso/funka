import { test, expect } from '@playwright/test';
import { login } from './helpers';
for (const identity of [{email:'pending-browser@example.test',heading:'Acceso pendiente'},{email:'joel.yc23@gmail.com',heading:'Mis pedidos'}]) {
  test(`Google emulado: ${identity.heading}, perfil persistido y cierre de sesión`, async ({page}) => {
    test.setTimeout(60000);
    await login(page,identity.email);
    await expect(page.getByRole('heading',{name:identity.heading,exact:true})).toBeVisible({timeout:20000});
    if(identity.heading==='Mis pedidos')await expect(page.getByRole('button',{name:'Configurar equipo y marca'})).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading',{name:identity.heading,exact:true})).toBeVisible({timeout:20000});
    await page.getByRole('button',{name:'Cerrar sesión'}).click();
    await expect(page.getByRole('button',{name:'Continuar con Google'})).toBeVisible();
  });
}
