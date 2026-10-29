// Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
// Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.

import { test, expect } from '@playwright/test';
import { assertNoDocumentOverflow, viewports } from './helpers';

for (const viewport of viewports) {
  test(`public pages fit ${viewport.name} (${viewport.width}x${viewport.height})`, async ({ page }, testInfo) => {
    test.setTimeout(60_000);
    await page.setViewportSize(viewport);
    for (const route of ['/', '/login', '/cadastro', '/termos', '/privacidade']) {
      await page.goto(route);
      await expect(page.locator('body')).toBeVisible();
      await assertNoDocumentOverflow(page);
    }
    if (['mobile-small', 'tablet-portrait', 'full-hd', 'ultrawide'].includes(viewport.name)) {
      await page.goto('/login');
      await page.screenshot({ path: testInfo.outputPath(`${viewport.name}.png`), fullPage: true });
    }
  });
}

test('200% zoom equivalent 320 CSS pixels', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/login');
  await assertNoDocumentOverflow(page);
});
