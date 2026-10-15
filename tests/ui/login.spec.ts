import { test, expect } from '@playwright/test';
for (const width of [1280,390]) {
  test(`ingreso accesible y footer exacto a ${width}px`, async ({page}) => {
    await page.setViewportSize({width,height:850});
    const errors: string[] = [];
    page.on('pageerror',error => errors.push(error.message));
    await page.goto('/');
    await expect(page.getByRole('heading',{name:'Menos pendientes en la mente.'})).toBeVisible();
    await expect(page.getByRole('button',{name:'Continuar con Google'})).toBeDisabled();
    await expect(page.locator('footer')).toHaveText('A project by Joel Yañez @manaturaloso');
    const link = page.locator('footer a');
    await expect(link).toHaveText('@manaturaloso');
    await expect(link).toHaveAttribute('href','https://www.instagram.com/manaturaloso');
    await page.keyboard.press('Tab');
    await expect(link).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  });
}
