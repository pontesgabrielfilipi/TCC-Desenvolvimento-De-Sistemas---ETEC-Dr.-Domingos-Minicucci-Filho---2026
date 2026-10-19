import { expect, type Page } from '@playwright/test';

export const viewports = [
  { name: 'mobile-small', width: 320, height: 568 },
  { name: 'mobile-compact', width: 360, height: 800 },
  { name: 'mobile', width: 390, height: 844 },
  { name: 'mobile-large', width: 430, height: 932 },
  { name: 'tablet-portrait', width: 768, height: 1024 },
  { name: 'tablet-landscape', width: 1024, height: 768 },
  { name: 'notebook-hd', width: 1280, height: 720 },
  { name: 'notebook', width: 1366, height: 768 },
  { name: 'full-hd', width: 1920, height: 1080 },
  { name: 'qhd', width: 2560, height: 1440 },
  { name: 'ultrawide', width: 3440, height: 1440 },
] as const;

export async function assertNoDocumentOverflow(page: Page) {
  const violations = await page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const scrollWidth = document.documentElement.scrollWidth;
    const offenders = [...document.querySelectorAll('body *')].filter(element => {
      if (!(element instanceof HTMLElement || element instanceof SVGElement)) return false;
      const style = getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden' || style.position === 'fixed') return false;
      const rectangle = element.getBoundingClientRect();
      if (!rectangle.width || !rectangle.height) return false;
      if (rectangle.right <= width + 1 && rectangle.left >= -1) return false;
      let parent = element.parentElement;
      while (parent) {
        const overflow = getComputedStyle(parent).overflowX;
        if (['auto', 'scroll', 'hidden', 'clip'].includes(overflow)) return false;
        parent = parent.parentElement;
      }
      return true;
    }).slice(0, 8).map(element => `${element.tagName.toLowerCase()}${element.className ? `.${String(element.className).split(' ').slice(0, 2).join('.')}` : ''}`);
    return { width, scrollWidth, offenders };
  });
  expect(violations.scrollWidth, `Global horizontal overflow: ${JSON.stringify(violations)}`).toBeLessThanOrEqual(violations.width + 1);
}

export async function assertLocalTableScrolling(page: Page) {
  const tables = page.locator('table:visible');
  for (let index = 0; index < await tables.count(); index++) {
    const table = tables.nth(index);
    const scroll = await table.evaluate(element => {
      let parent = element.parentElement;
      while (parent && parent !== document.body) {
        const css = getComputedStyle(parent);
        if (['auto', 'scroll'].includes(css.overflowX)) {
          return { found: true, client: parent.clientWidth, full: parent.scrollWidth };
        }
        parent = parent.parentElement;
      }
      return { found: false, client: 0, full: 0 };
    });
    expect(scroll.found, `Table ${index + 1} is missing a local horizontal scroll container`).toBeTruthy();
  }
}
