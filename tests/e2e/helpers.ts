import { expect, type Page } from '@playwright/test';
export async function login(page:Page,email:string) {
  await page.goto('/');
  await page.evaluate(async()=>{const {auth}=await import('/src/lib/firebase.ts');await auth?.authStateReady();});
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('button')).some(button=>button.getAttribute('aria-label')==='Cerrar sesión'||(button.textContent?.includes('Continuar con Google')&&!button.disabled)));
  if(await page.getByRole('button',{name:'Cerrar sesión'}).isVisible()){await page.getByRole('button',{name:'Cerrar sesión'}).click();await expect(page.getByRole('button',{name:'Continuar con Google'})).toBeEnabled();}
  const popupPromise=page.waitForEvent('popup',{timeout:20000});
  await page.getByRole('button',{name:'Continuar con Google'}).click();
  const popup=await popupPromise;
  await popup.waitForLoadState('domcontentloaded');
  if(await popup.locator('#add-account-button').isVisible())await popup.locator('#add-account-button').click();
  await popup.locator('#email-input').fill(email);
  await popup.locator('#display-name-input').fill('Identidad de prueba');
  await popup.locator('#sign-in').click();
  await expect(page.getByRole('button',{name:'Cerrar sesión'})).toBeVisible({timeout:20000});
}
