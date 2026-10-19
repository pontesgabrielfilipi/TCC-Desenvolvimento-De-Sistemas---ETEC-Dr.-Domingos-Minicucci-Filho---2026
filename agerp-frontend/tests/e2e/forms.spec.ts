import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { assertNoDocumentOverflow, viewports } from './helpers';

for (const viewport of [viewports[0], viewports[2], viewports[4], viewports[8]]) {
  test(`login and registration forms accessible at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    for (const url of ['/login', '/cadastro']) {
      await page.goto(url);
      await assertNoDocumentOverflow(page);
      const fields = page.locator('input:visible');
      for (let i = 0; i < await fields.count(); i++) {
        const field = fields.nth(i);
        const id = await field.getAttribute('id');
        const accessible = await field.getAttribute('aria-label') || await field.getAttribute('placeholder') || (id ? await page.locator(`label[for="${id}"]`).count() : 0);
        expect(accessible, `Missing label on ${url} input ${i}`).toBeTruthy();
      }
      const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
      expect(audit.violations, JSON.stringify(audit.violations.map(v => ({ id: v.id, nodes: v.nodes.length })))).toEqual([]);
    }
  });
}
