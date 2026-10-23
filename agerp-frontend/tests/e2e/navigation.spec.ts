import { test, expect } from '@playwright/test';
import { assertNoDocumentOverflow } from './helpers';

test('protected routes reject an unauthenticated browser', async ({ page }) => {
  for (const path of ['/dashboard', '/clientes', '/produtos', '/pedidos', '/admin']) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login/);
    await assertNoDocumentOverflow(page);
  }
});

// Credentials are injected at runtime only; no accounts or secrets are committed.
for (const role of ['ADMIN', 'USER'] as const) {
  const email = process.env[`E2E_${role}_EMAIL`];
  const password = process.env[`E2E_${role}_PASSWORD`];
  if (!email || !password) continue;

  test(`${role} navigation, active route, access and logout`, async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(password);
    await page.locator('form button[type="submit"]').click();
    await expect(page).toHaveURL(/\/dashboard/);
    const primary = page.getByRole('navigation', { name: /navega/i }).first();
    if (role === 'ADMIN') await expect(primary.getByRole('link', { name: 'Administração' })).toBeVisible();
    else {
      await expect(primary.getByRole('link', { name: 'Administração' })).toHaveCount(0);
      await page.goto('/admin');
      await expect(page).toHaveURL(/\/dashboard/);
    }
    for (const [name, path] of [['Dashboard', '/dashboard'], ['Clientes', '/clientes'], ['Produtos', '/produtos'], ['Pedidos', '/pedidos']]) {
      await page.goto(path);
      await expect(page.getByRole('navigation', { name: /navega/i }).first().getByRole('link', { name })).toHaveAttribute('aria-current', 'page');
      await assertNoDocumentOverflow(page);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: /abrir menu de navegação/i }).click();
    await expect(page.locator('#navegacao-mobile')).toHaveAttribute('aria-hidden', 'false');
    await page.keyboard.press('Escape');
    await expect(page.locator('#navegacao-mobile')).toHaveAttribute('aria-hidden', 'true');
    await page.getByRole('button', { name: /abrir menu de navegação/i }).click();
    await page.locator('#navegacao-mobile').getByRole('button', { name: /sair da conta/i }).click();
    await expect(page).toHaveURL(/\/login/);
  });
}
