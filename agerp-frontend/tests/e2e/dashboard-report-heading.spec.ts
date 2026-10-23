import { expect, test, type Page } from '@playwright/test';
import { assertNoDocumentOverflow } from './helpers';

const usuario = {
  id: 1, nome: 'Operador de teste', email: 'operador@agerp.local',
  perfilNome: 'OPERADOR', paginas: ['DASHBOARD'], nivelAutoridade: 10,
  ativo: true, statusAcesso: 'APROVADO', trocaSenhaObrigatoria: false,
};

const dados = {
  totalClientes: 2, totalProdutos: 5, vendasMes: 1800, pedidosPendentes: 1,
  produtosEstoqueBaixo: 1, vendasMensais: [{ mes: '10/2026', valor: 1800 }],
  topProdutos: [], distribuicaoClientes: [{ name: 'Pessoa Física', value: 2 }],
  statusPedidos: [{ name: 'PENDENTE', value: 1 }],
  estoqueBaixo: [{ nome: 'Produto de teste', quantidade: 1 }],
};

async function prepararDashboard(page: Page) {
  await page.route('**/api/auth/me', route => route.fulfill({ json: usuario }));
  await page.route('**/api/configuracoes/aparencia', route => route.fulfill({
    json: { nomeEmpresa: 'AGERP', exibirAlertasEstoque: true },
  }));
  await page.route('**/api/dashboard/relatorio-completo*', route => route.fulfill({ json: dados }));
  await page.route('**/api/dashboard/estoque-baixo', route => route.fulfill({
    json: [{ nome: 'Produto de teste', quantidade: 1, minimo: 5 }],
  }));
}

test.beforeEach(async ({ page }) => prepararDashboard(page));

for (const viewport of [
  { name: 'celular compacto', width: 320, height: 568 },
  { name: 'celular pequeno', width: 360, height: 800 },
  { name: 'celular', width: 390, height: 844 },
  { name: 'celular grande', width: 430, height: 932 },
  { name: 'limite celular', width: 639, height: 900 },
  { name: 'limite tablet', width: 640, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'tablet horizontal', width: 1023, height: 768 },
  { name: 'PC estreito', width: 1024, height: 768 },
  { name: 'PC', width: 1440, height: 900 },
]) {
  test(`agrupamento de relatórios no ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/dashboard');

    const grupo = page.getByRole('region', { name: 'Relatórios' });
    const titulo = grupo.getByRole('heading', { name: 'Relatórios' });
    const botoes = grupo.getByRole('button');
    const nomes = ['Vendas do Mês', 'Clientes Inativos', 'Estoque Baixo'];
    await expect(grupo).toBeVisible();
    await expect(titulo).toBeVisible();
    await expect(botoes).toHaveCount(3);
    for (const nome of nomes) await expect(grupo.getByRole('button', { name: new RegExp(nome) })).toBeVisible();

    const tituloBox = await titulo.boundingBox();
    const primeiraBox = await botoes.first().boundingBox();
    expect(tituloBox && primeiraBox && tituloBox.y + tituloBox.height <= primeiraBox.y).toBeTruthy();

    const atualizar = page.getByRole('button', { name: /Atualizar/ });
    await expect(atualizar).toBeVisible();
    expect(await grupo.getByRole('button', { name: /Atualizar/ }).count()).toBe(0);

    // No WebKit, a largura útil do viewport pode diferir da configurada em pixels.
    const { tablet, desktop } = await page.evaluate(() => ({
      tablet: matchMedia('(min-width: 640px)').matches,
      desktop: matchMedia('(min-width: 1024px)').matches,
    }));
    if (!tablet) {
      const faixa = page.getByTestId('dashboard-report-scroll');
      const largura = await faixa.evaluate(el => ({
        client: el.clientWidth,
        scroll: el.scrollWidth,
        overflow: getComputedStyle(el).overflowX,
        overscroll: getComputedStyle(el).overscrollBehaviorX,
        touchAction: getComputedStyle(el).touchAction,
      }));
      expect(largura.scroll).toBeGreaterThanOrEqual(largura.client);
      expect(largura.overflow).toBe('auto');
      // WebKit pode não expor essas propriedades pelo CSSOM nessa versão.
      if (largura.overscroll !== undefined) expect(largura.overscroll).toBe('contain');
      if (largura.touchAction !== undefined) expect(largura.touchAction).toBe('auto'); // O gesto vertical continua livre.
      const linhas = await botoes.evaluateAll(elements => elements.map(el => Math.round(el.getBoundingClientRect().top)));
      expect(new Set(linhas).size).toBe(1);
      const botoesLegiveis = await botoes.evaluateAll(elements => elements.map(el => ({
        width: el.getBoundingClientRect().width,
        height: el.getBoundingClientRect().height,
        whiteSpace: getComputedStyle(el).whiteSpace,
      })));
      for (const botao of botoesLegiveis) {
        expect(botao.width).toBeGreaterThanOrEqual(120);
        expect(botao.height).toBeGreaterThanOrEqual(44);
        expect(botao.whiteSpace).toBe('nowrap');
      }

      if (largura.scroll > largura.client) {
        await faixa.focus();
        await page.keyboard.press('ArrowRight');
        await expect.poll(() => faixa.evaluate(el => el.scrollLeft)).toBeGreaterThan(0);
        await faixa.evaluate(el => { el.scrollLeft = el.scrollWidth - el.clientWidth; });
      }
      // Tolera apenas diferenças subpixel de arredondamento do navegador.
      await expect(botoes.last()).toBeInViewport({ ratio: 0.99 });

      const superficie = page.getByTestId('dashboard-scroll-surface');
      const rolagemVertical = await superficie.evaluate(el => {
        el.scrollTop = el.scrollHeight - el.clientHeight;
        return { top: el.scrollTop, max: el.scrollHeight - el.clientHeight };
      });
      expect(rolagemVertical.max).toBeGreaterThan(0);
      expect(rolagemVertical.top).toBeGreaterThan(0);
    } else if (!desktop) {
      const faixa = page.getByTestId('dashboard-report-scroll');
      expect(await faixa.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
      const linhas = await botoes.evaluateAll(elements => elements.map(el => Math.round(el.getBoundingClientRect().top)));
      expect(new Set(linhas).size).toBe(1);
    } else {
      await expect(page.getByTestId('dashboard-report-scroll')).toBeHidden();
    }
    await assertNoDocumentOverflow(page);

    // Simula um botão não renderizado pela camada de permissões sem mudar as regras atuais.
    await grupo.getByRole('button', { name: /Clientes Inativos/ }).evaluate(el => el.remove());
    await expect(titulo).toBeVisible();
    await expect(grupo.getByRole('button')).toHaveCount(2);
    await expect(atualizar).toBeVisible();
    await assertNoDocumentOverflow(page);
  });
}

test('exportações e atualização continuam acessíveis fora e dentro da faixa rolável', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/dashboard');
  const grupo = page.getByRole('region', { name: 'Relatórios' });

  for (const [nome, arquivo] of [
    ['Vendas do Mês', /^Vendas_do_Mes_.*\.xlsx$/],
    ['Clientes Inativos', /^Clientes_Inativos_.*\.xlsx$/],
    ['Estoque Baixo', /^Estoque_Baixo_.*\.xlsx$/],
  ] as const) {
    const downloadPromise = page.waitForEvent('download');
    await grupo.getByRole('button', { name: new RegExp(nome) }).click();
    expect((await downloadPromise).suggestedFilename()).toMatch(arquivo);
  }

  const requisicao = page.waitForRequest(request => request.url().includes('/api/dashboard/relatorio-completo') && request.url().includes('refresh=true'));
  await page.getByRole('button', { name: /Atualizar/ }).click();
  await requisicao;
  await expect(page.getByText('Dados atualizados com sucesso.')).toBeVisible();
});

test('ações da faixa funcionam por toque em celular', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 360, height: 800 }, hasTouch: true });
  try {
    const page = await context.newPage();
    await prepararDashboard(page);
    await page.goto('/dashboard');
    const faixa = page.getByTestId('dashboard-report-scroll');
    const primeiro = faixa.getByRole('button', { name: /Vendas do Mês/ });
    const caixa = await primeiro.boundingBox();
    expect(caixa).not.toBeNull();
    const download = page.waitForEvent('download');
    await page.touchscreen.tap(caixa!.x + caixa!.width / 2, caixa!.y + caixa!.height / 2);
    expect((await download).suggestedFilename()).toMatch(/^Vendas_do_Mes_.*\.xlsx$/);
    await assertNoDocumentOverflow(page);
  } finally {
    await context.close();
  }
});
