// Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
// Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.

import { expect, test, type Page, type Route } from '@playwright/test';
import { assertNoDocumentOverflow } from './helpers';

const user = {
  id: 1, nome: 'Administrador', email: 'admin@agerp.local', perfilNome: 'ADMIN',
  ativo: true, statusAcesso: 'APROVADO', trocaSenhaObrigatoria: false,
  paginas: ['DASHBOARD', 'ADMIN'], nivelAutoridade: 100,
};

const emptyPage = { conteudo: [], totalElementos: 0, pagina: 0, tamanho: 10, totalPaginas: 0 };
const widths = [320, 360, 390, 430, 600, 767, 768, 820, 1024, 1180, 1280, 1440, 1920];
const samples = [
  { name: 'pequenos', sales: 0.01, revenue: 0.01, ticket: 3.5, count: 2 },
  { name: 'valores-reais', sales: 269810.15, revenue: 221725.35, ticket: 12987.4, count: 8759 },
  { name: 'grandes', sales: 123456789.99, revenue: 987654321.87, ticket: 12345678.65, count: 98765432 },
] as const;

type Sample = (typeof samples)[number];

async function mockIndicators(page: Page, sample: Sample) {
  await page.route('**/api/**', async (route: Route) => {
    const path = new URL(route.request().url()).pathname;
    if (!path.startsWith('/api/')) return route.continue();
    let data: unknown = {};
    if (path === '/api/auth/me') data = user;
    if (path === '/api/configuracoes/aparencia') data = { nomeEmpresa: 'AGERP', exibirAlertasEstoque: true };
    if (path === '/api/dashboard/relatorio-completo') data = {
      totalClientes: sample.count, vendasMes: sample.sales, totalProdutos: sample.count,
      pedidosPendentes: sample.count, produtosEstoqueBaixo: sample.count,
      vendasMensais: [], topProdutos: [], distribuicaoClientes: [], statusPedidos: [], estoqueBaixo: [],
    };
    if (path === '/api/admin/usuarios') data = [];
    if (path === '/api/clientes') data = [];
    if (path === '/api/admin/estatisticas') data = {
      usuarios: { total: sample.count, ativos: sample.count, pendentes: 0, bloqueados: 0, distribuicaoPerfis: [], desempenho: emptyPage, movimentacoes: emptyPage },
      clientes: { total: sample.count, comPedidos: sample.count, topFrequentes: emptyPage, evolucao: [] },
      produtos: { total: sample.count, quantidadeVendida: sample.count, valorVendido: sample.revenue, estoqueDisponivel: sample.count, estoqueBaixo: 0, topVendidos: emptyPage },
      pedidos: { total: sample.count, pendentes: sample.count, emAndamento: 0, concluidos: 0, cancelados: 0, faturamento: sample.revenue, ticketMedio: sample.ticket, distribuicaoStatus: [], evolucaoMensal: [] },
      filtrosDisponiveis: { statusPedidos: [], categoriasProduto: [] }, metadados: {},
    };
    await route.fulfill({ contentType: 'application/json', status: 200, body: JSON.stringify(data) });
  });
}

const currency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

async function assertIndicatorLayout(page: Page, labels: string[]) {
  await page.evaluate(() => document.fonts.ready);
  await expect.poll(async () => page.locator('.agerp-indicator-grid [data-testid="indicator-value"]').evaluateAll(values =>
    values.every(value => {
      const text = value.getBoundingClientRect();
      const area = value.parentElement!.getBoundingClientRect();
      const card = value.closest('article')!.getBoundingClientRect();
      return getComputedStyle(value).whiteSpace === 'nowrap'
        && text.width <= area.width + 1
        && text.left >= area.left - 1 && text.right <= area.right + 1
        && text.top >= card.top && text.bottom <= card.bottom + 1;
    }),
  )).toBe(true);

  for (const label of labels) {
    const card = page.getByRole('article', { name: label });
    await expect(card).toBeVisible();
    await expect(card.getByTestId('indicator-value')).toHaveCSS('white-space', 'nowrap');
  }
  await assertNoDocumentOverflow(page);
}

for (const sample of samples) {
  test(`Dashboard: indicadores ${sample.name} permanecem inteiros`, async ({ page }, testInfo) => {
    test.setTimeout(150_000);
    await mockIndicators(page, sample);
    await page.goto('/dashboard');
    const labels = ['Total Clientes', 'Vendas do Mês', 'Produtos em Estoque', 'Pedidos Pendentes', 'Estoque Baixo'];
    await expect(page.getByRole('article', { name: 'Vendas do Mês' }).getByTestId('indicator-value')).toHaveText(currency(sample.sales));
    await expect(page.getByRole('article', { name: 'Total Clientes' }).getByTestId('indicator-value')).toHaveText(sample.count.toLocaleString('pt-BR'));

    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      await assertIndicatorLayout(page, labels);
      if (sample.name === 'grandes' && [320, 768, 1180, 1440].includes(width)) {
        await page.locator('.agerp-indicator-grid').first().screenshot({ path: testInfo.outputPath(`dashboard-${sample.name}-${width}px.png`) });
      }
    }
  });

  test(`Admin: indicadores ${sample.name} permanecem inteiros`, async ({ page }, testInfo) => {
    test.setTimeout(150_000);
    await mockIndicators(page, sample);
    await page.goto('/admin');
    await page.getByRole('button', { name: /Estatísticas/ }).click();
    await expect(page.getByRole('article', { name: 'Faturamento' }).getByTestId('indicator-value')).toHaveText(currency(sample.revenue));
    await expect(page.getByRole('article', { name: 'Ticket médio' }).getByTestId('indicator-value')).toHaveText(currency(sample.ticket));
    await expect(page.getByRole('article', { name: 'Valor vendido' }).getByTestId('indicator-value')).toHaveText(currency(sample.revenue));
    await expect(page.getByRole('article', { name: 'Quantidade vendida' }).getByTestId('indicator-value')).toHaveText(sample.count.toLocaleString('pt-BR'));

    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      await assertIndicatorLayout(page, ['Faturamento', 'Ticket médio', 'Valor vendido', 'Quantidade vendida']);
      if (sample.name === 'grandes' && [320, 768, 1180, 1440].includes(width)) {
        await page.locator('.agerp-indicator-grid').first().screenshot({ path: testInfo.outputPath(`admin-${sample.name}-${width}px.png`) });
      }
    }
  });
}
