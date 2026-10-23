import { expect, test, type Page } from '@playwright/test';
import { assertNoDocumentOverflow } from './helpers';

const APP_BACKGROUND = 'rgb(226, 232, 240)';
const CARD_BACKGROUND = 'rgb(255, 255, 255)';
const BACKGROUND_VIEWPORTS = [320, 390, 768, 1024, 1440, 1920] as const;

async function backgroundState(page: Page) {
  return page.evaluate(() => {
    const properties = (element: Element) => {
      const style = getComputedStyle(element);
      return {
        backgroundColor: style.backgroundColor,
        opacity: style.opacity,
        filter: style.filter,
        backdropFilter: style.backdropFilter,
        position: style.position,
        visibility: style.visibility,
      };
    };

    const root = document.querySelector('#root');
    const layout = document.querySelector('[data-testid="authenticated-layout"]');
    const dashboardPage = document.querySelector('[data-testid="dashboard-page"]');
    const scrollSurface = document.querySelector('[data-testid="dashboard-scroll-surface"]');
    const card = document.querySelector('[data-testid="dashboard-summary-card"]');
    if (!root || !layout || !dashboardPage || !scrollSurface || !card) {
      throw new Error('As superfícies esperadas do Dashboard não foram encontradas.');
    }

    return {
      html: properties(document.documentElement),
      body: properties(document.body),
      root: properties(root),
      layout: properties(layout),
      dashboardPage: properties(dashboardPage),
      scrollSurface: properties(scrollSurface),
      card: properties(card),
      overlayCount: document.querySelectorAll('[data-testid="mobile-navigation-overlay"]').length,
      sidebar: {
        ariaHidden: document.querySelector('#navegacao-mobile')?.getAttribute('aria-hidden'),
        visibility: getComputedStyle(document.querySelector('#navegacao-mobile')!).visibility,
      },
    };
  });
}

async function renderedBackgroundSample(
  page: Page,
  screenshot: Buffer,
  point?: { x: number; y: number },
) {
  const surface = page.getByTestId('dashboard-scroll-surface');
  const surfaceBox = await surface.boundingBox();
  if (!surfaceBox) throw new Error('Não foi possível localizar a área de amostragem visual.');
  const source = `data:image/png;base64,${screenshot.toString('base64')}`;

  return page.evaluate(async ({ source, surfaceBox, point }) => {
    const image = new Image();
    image.src = source;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D indisponível para amostragem visual.');
    context.drawImage(image, 0, 0);
    const pixelAt = (x: number, y: number) => [...context.getImageData(x, y, 1, 1).data];
    if (point) return { point, pixel: pixelAt(point.x, point.y) };

    const expected = [226, 232, 240, 255];
    const startX = Math.floor(surfaceBox.x + Math.min(264, surfaceBox.width / 2));
    const endX = Math.ceil(surfaceBox.x + surfaceBox.width);
    const startY = Math.floor(surfaceBox.y);
    const endY = Math.min(Math.ceil(surfaceBox.y + surfaceBox.height), image.naturalHeight);
    for (let y = startY; y < endY; y += 1) {
      for (let x = startX; x < endX; x += 1) {
        const pixel = pixelAt(x, y);
        if (pixel.every((channel, index) => channel === expected[index])) return { point: { x, y }, pixel };
      }
    }
    throw new Error('Nenhum pixel puro da superfície do aplicativo foi encontrado na região visível.');
  }, { source, surfaceBox, point });
}

const usuario = {
  id: 1,
  nome: 'Usuário de teste',
  email: 'teste@agerp.local',
  perfilNome: 'ADMIN',
  ativo: true,
  statusAcesso: 'APROVADO',
  trocaSenhaObrigatoria: false,
  paginas: ['DASHBOARD', 'CLIENTES', 'PRODUTOS', 'PEDIDOS', 'ADMIN'],
  nivelAutoridade: 100,
};

const dashboard = {
  totalClientes: 18,
  totalProdutos: 42,
  vendasMes: 12500,
  pedidosPendentes: 4,
  produtosEstoqueBaixo: 2,
  vendasMensais: [{ mes: '10/2026', valor: 12500 }],
  topProdutos: [{ nome: 'Produto A', vendas: 8 }],
  distribuicaoClientes: [{ name: 'Pessoa Física', value: 12 }, { name: 'Pessoa Jurídica', value: 6 }],
  statusPedidos: [
    { name: 'PENDENTE', value: 4 },
    { name: 'CONFIRMADO', value: 3 },
    { name: 'EM_PREPARACAO', value: 2 },
    { name: 'PRONTO', value: 1 },
    { name: 'ENTREGUE', value: 8 },
    { name: 'CANCELADO', value: 2 },
    { name: 'STATUS_NOVO', value: 1 },
    { name: 'SEM_OCORRENCIAS', value: 0 },
  ],
  estoqueBaixo: [{ nome: 'Produto B', quantidade: 2 }],
};

test.beforeEach(async ({ page }) => {
  await page.route('**/api/auth/me', route => route.fulfill({ json: usuario }));
  await page.route('**/api/configuracoes/aparencia', route => route.fulfill({ json: { nomeEmpresa: 'AGERP', exibirAlertasEstoque: true } }));
  await page.route('**/api/dashboard/relatorio-completo*', route => route.fulfill({ json: dashboard }));
});

test('gráfico de status e fundo permanecem legíveis e responsivos', async ({ page }, testInfo) => {
  for (const viewport of [{ width: 320, height: 568 }, { width: 768, height: 1024 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport);
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'Status dos Pedidos' })).toBeVisible();

    const legenda = page.getByRole('list', { name: 'Legenda dos status dos pedidos' });
    await expect(legenda.getByRole('listitem')).toHaveCount(7);
    await expect(legenda).toContainText('Em preparação');
    await expect(legenda).not.toContainText('Sem ocorrencias');

    const graficoStatus = page.locator('[aria-label^="Distribuição de"]');
    const fatias = graficoStatus.locator('.recharts-pie-sector .recharts-sector');
    await expect(fatias).toHaveCount(7);
    const cores = await fatias.evaluateAll(elementos =>
      elementos.map(elemento => elemento.getAttribute('fill') ?? getComputedStyle(elemento).fill),
    );
    expect(new Set(cores).size).toBe(7);
    expect(await graficoStatus.boundingBox()).not.toBeNull();
    await assertNoDocumentOverflow(page);

    expect(await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor)).toBe(APP_BACKGROUND);
    if (viewport.width === 320 || viewport.width === 1440) {
      await page.getByRole('heading', { name: 'Status dos Pedidos' }).locator('..').screenshot({
        path: testInfo.outputPath(`status-pedidos-${viewport.width}px.png`),
      });
    }
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Abrir menu de navegação' }).click();
  await expect(page.locator('#navegacao-mobile')).toHaveAttribute('aria-hidden', 'false');
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor)).toBe(APP_BACKGROUND);
  await page.keyboard.press('Escape');
  await expect(page.locator('#navegacao-mobile')).toHaveAttribute('aria-hidden', 'true');

  await page.unroute('**/api/dashboard/relatorio-completo*');
  await page.route('**/api/dashboard/relatorio-completo*', route => route.fulfill({
    json: { totalClientes: null, statusPedidos: null },
  }));
  await page.goto('/dashboard');
  await expect(page.getByText('Nenhum pedido com status contabilizável.')).toBeVisible();
  await assertNoDocumentOverflow(page);
});

test('background e sidebar', async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const heights: Record<(typeof BACKGROUND_VIEWPORTS)[number], number> = {
    320: 568,
    390: 844,
    768: 1024,
    1024: 768,
    1440: 900,
    1920: 1080,
  };

  for (const width of BACKGROUND_VIEWPORTS) {
    await page.setViewportSize({ width, height: heights[width] });
    await page.goto('/dashboard');
    await expect(page.getByTestId('dashboard-summary-card')).toBeVisible();

    for (const surface of [
      page.getByTestId('authenticated-layout'),
      page.getByTestId('dashboard-page'),
      page.getByTestId('dashboard-scroll-surface'),
    ]) {
      await expect(surface).toHaveCSS('background-color', APP_BACKGROUND);
      await expect(surface).toHaveCSS('opacity', '1');
      await expect(surface).toHaveCSS('filter', 'none');
      await expect(surface).toHaveCSS('backdrop-filter', 'none');
    }

    await expect(page.getByTestId('dashboard-summary-card')).toHaveCSS('background-color', CARD_BACKGROUND);
    const globals = await page.evaluate(() => ({
      html: getComputedStyle(document.documentElement).backgroundColor,
      body: getComputedStyle(document.body).backgroundColor,
      root: getComputedStyle(document.querySelector('#root')!).backgroundColor,
      token: getComputedStyle(document.documentElement).getPropertyValue('--agerp-app-background').trim(),
    }));
    expect(globals).toEqual({
      html: APP_BACKGROUND,
      body: APP_BACKGROUND,
      root: APP_BACKGROUND,
      token: '#e2e8f0',
    });
    await expect(page.getByTestId('mobile-navigation-overlay')).toHaveCount(0);
    await assertNoDocumentOverflow(page);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/dashboard');
  await expect(page.getByTestId('dashboard-summary-card')).toBeVisible();
  const stateA = await backgroundState(page);
  const screenshotA = await page.screenshot({
    path: testInfo.outputPath('dashboard-sidebar-fechado.png'),
    animations: 'disabled',
    scale: 'css',
  });
  const sampleA = await renderedBackgroundSample(page, screenshotA);
  expect(sampleA.pixel).toEqual([226, 232, 240, 255]);

  await page.getByRole('button', { name: 'Abrir menu de navegação' }).click();
  const overlay = page.getByTestId('mobile-navigation-overlay');
  await expect(overlay).toBeVisible();
  await expect(overlay).toHaveCSS('background-color', 'rgba(0, 0, 0, 0.5)');
  await expect(overlay).toHaveCSS('opacity', '1');
  await expect(overlay).toHaveCSS('filter', 'none');
  await expect(overlay).toHaveCSS('backdrop-filter', 'none');
  await expect(overlay).toHaveCSS('position', 'fixed');
  await expect(overlay).toHaveCSS('z-index', '40');
  await expect(page.locator('#navegacao-mobile')).toHaveAttribute('aria-hidden', 'false');
  await expect(page.locator('#navegacao-mobile')).toHaveCSS('visibility', 'visible');
  const screenshotB = await page.screenshot({
    path: testInfo.outputPath('dashboard-sidebar-aberto.png'),
    animations: 'disabled',
    scale: 'css',
  });
  const sampleB = await renderedBackgroundSample(page, screenshotB, sampleA.point);
  expect(sampleB.pixel).not.toEqual(sampleA.pixel);
  expect(sampleB.pixel.slice(0, 3).every((channel, index) => channel < sampleA.pixel[index])).toBeTruthy();

  await overlay.click({ position: { x: 300, y: 400 } });
  await expect(page.getByTestId('mobile-navigation-overlay')).toHaveCount(0);
  await expect(page.locator('#navegacao-mobile')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('#navegacao-mobile')).toHaveCSS('visibility', 'hidden');
  const stateC = await backgroundState(page);
  const screenshotC = await page.screenshot({
    path: testInfo.outputPath('dashboard-sidebar-fechado-novamente.png'),
    animations: 'disabled',
    scale: 'css',
  });
  const sampleC = await renderedBackgroundSample(page, screenshotC, sampleA.point);
  expect(stateC).toEqual(stateA);
  expect(sampleC.pixel).toEqual(sampleA.pixel);
  expect(screenshotC.equals(screenshotA)).toBeTruthy();

  await page.getByRole('button', { name: 'Abrir menu de navegação' }).click();
  await expect(page.getByTestId('mobile-navigation-overlay')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('mobile-navigation-overlay')).toHaveCount(0);
  expect(await backgroundState(page)).toEqual(stateA);

  await page.getByRole('button', { name: 'Abrir menu de navegação' }).click();
  await expect(page.getByTestId('mobile-navigation-overlay')).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 768 });
  await expect.poll(() => page.evaluate(() => window.matchMedia('(min-width: 1024px)').matches)).toBeTruthy();
  await expect(page.getByTestId('mobile-navigation-overlay')).toHaveCount(0);
  await expect(page.locator('#navegacao-mobile')).toHaveAttribute('aria-hidden', 'true');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: 'Abrir menu de navegação' })).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByTestId('mobile-navigation-overlay')).toHaveCount(0);
  await expect(page.getByTestId('dashboard-scroll-surface')).toHaveCSS('background-color', APP_BACKGROUND);

  await page.setViewportSize({ width: 1440, height: 900 });
  for (const path of ['/clientes', '/produtos', '/pedidos', '/admin']) {
    await page.goto(path);
    await expect(page.getByTestId('authenticated-layout')).toHaveCSS('background-color', APP_BACKGROUND);
    await expect(page.locator('.bg-app-background').last()).toHaveCSS('background-color', APP_BACKGROUND);
    await assertNoDocumentOverflow(page);
  }
});
