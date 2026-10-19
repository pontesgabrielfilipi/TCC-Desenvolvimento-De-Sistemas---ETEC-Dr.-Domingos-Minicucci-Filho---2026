import { test } from '@playwright/test';
import { assertLocalTableScrolling, assertNoDocumentOverflow } from './helpers';

const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;

if (email && password) {
  test('authenticated tables scroll in their containers without document overflow', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(password);
    await page.locator('form button[type="submit"]').click();
    await page.setViewportSize({ width: 320, height: 568 });
    for (const route of ['/clientes', '/produtos', '/pedidos', '/admin']) {
      await page.goto(route);
      await assertNoDocumentOverflow(page);
      await assertLocalTableScrolling(page);
    }
  });
}
