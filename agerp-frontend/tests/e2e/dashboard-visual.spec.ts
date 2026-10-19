import { expect, test } from '@playwright/test';
import { assertNoDocumentOverflow } from './helpers';

const usuario = {
  id: 1,
  nome: 'Usuário de teste',
  email: 'teste@agerp.local',
  perfilNome: 'ADMIN',
  ativo: true,
  statusAcesso: 'APROVADO',
  trocaSenhaObrigatoria: false,
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

    expect(await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor)).toBe('rgb(241, 245, 249)');
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
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor)).toBe('rgb(241, 245, 249)');
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
