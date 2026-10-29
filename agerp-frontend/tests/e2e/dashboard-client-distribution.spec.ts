// Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
// Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.

import { expect, test, type Page } from '@playwright/test';
import { assertNoDocumentOverflow } from './helpers';

type Categoria = { name: string; value: number };

async function prepararPagina(page: Page, categorias: Categoria[]) {
  await page.route('**/api/auth/me', route => route.fulfill({ json: {
    id: 1, nome: 'Teste', email: 'teste@agerp.local', perfilNome: 'ADMIN',
    paginas: ['DASHBOARD', 'CLIENTES', 'PRODUTOS', 'PEDIDOS', 'ADMIN'],
    ativo: true, statusAcesso: 'APROVADO', trocaSenhaObrigatoria: false,
  } }));
  await page.route('**/api/configuracoes/aparencia', route => route.fulfill({ json: {
    nomeEmpresa: 'AGERP', exibirAlertasEstoque: false,
  } }));
  await page.route('**/api/dashboard/relatorio-completo*', route => route.fulfill({ json: {
    totalClientes: 999, // O total do gráfico deve usar as fatias, não o card de resumo.
    totalProdutos: 0, vendasMes: 0, pedidosPendentes: 0, produtosEstoqueBaixo: 0,
    vendasMensais: [], topProdutos: [], distribuicaoClientes: categorias,
    statusPedidos: [], estoqueBaixo: [],
  } }));
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'Distribuição de Clientes' })).toBeVisible();
}

for (const viewport of [{ width: 320, height: 700 }, { width: 768, height: 900 }, { width: 1440, height: 900 }]) {
  test(`duas categorias: legenda, total, fatias e tooltip em ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await prepararPagina(page, [{ name: 'Pessoa Física', value: 12 }, { name: 'Pessoa Jurídica', value: 6 }]);

    const card = page.getByTestId('dashboard-clientes-chart-card');
    const legenda = card.getByRole('list', { name: 'Legenda da distribuição de clientes' });
    await expect(legenda.getByRole('listitem')).toHaveCount(2);
    await expect(legenda.getByRole('listitem').nth(0)).toContainText('Pessoa Física');
    await expect(legenda.getByRole('listitem').nth(0)).toContainText('12 (66,7%)');
    await expect(legenda.getByRole('listitem').nth(1)).toContainText('Pessoa Jurídica');
    await expect(legenda.getByRole('listitem').nth(1)).toContainText('6 (33,3%)');
    await expect(card.getByText('Total:', { exact: false })).toContainText('18');

    const fatias = card.locator('.recharts-pie-sector .recharts-sector');
    await expect(fatias).toHaveCount(2);
    await expect(fatias.nth(0)).toHaveAttribute('fill', '#3b82f6');
    await expect(fatias.nth(1)).toHaveAttribute('fill', '#8b5cf6');
    await expect(legenda.locator('li span[style]').nth(0)).toHaveCSS('background-color', 'rgb(59, 130, 246)');
    await expect(legenda.locator('li span[style]').nth(1)).toHaveCSS('background-color', 'rgb(139, 92, 246)');

    // Em uma rosca, o centro do retângulo da fatia pode estar no furo ou em outra fatia.
    // Escolher um ponto que o navegador realmente identifica como pertencente à fatia.
    await card.scrollIntoViewIfNeeded();
    await expect.poll(async () => {
      const area = await fatias.nth(0).boundingBox();
      return Boolean(area && area.width > 0 && area.height > 0);
    }).toBe(true);
    const pontoFatia = await fatias.nth(0).evaluate(elemento => {
      const area = elemento.getBoundingClientRect();
      const esquerda = Math.max(0, area.left);
      const direita = Math.min(window.innerWidth, area.right);
      const topo = Math.max(0, area.top);
      const base = Math.min(window.innerHeight, area.bottom);
      for (let linha = 1; linha < 20; linha++) {
        for (let coluna = 1; coluna < 20; coluna++) {
          const x = esquerda + (direita - esquerda) * coluna / 20;
          const y = topo + (base - topo) * linha / 20;
          if (document.elementFromPoint(x, y) === elemento) return { x, y };
        }
      }
      return null;
    });
    if (!pontoFatia) throw new Error('Não foi encontrado ponto visível na fatia de Pessoa Física.');
    await page.mouse.move(pontoFatia.x, pontoFatia.y);
    const tooltip = card.getByTestId('dashboard-clientes-tooltip');
    await expect(tooltip).toContainText('Pessoa Física:');
    await expect(tooltip).toContainText('12 (66,7%)');
    await expect(tooltip.locator('span[style]')).toHaveCSS('background-color', 'rgb(59, 130, 246)');
    await assertNoDocumentOverflow(page);
  });
}

test('apenas uma categoria ocupa 100% do total e preserva sua cor', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await prepararPagina(page, [{ name: 'Pessoa Jurídica', value: 5 }]);
  const card = page.getByTestId('dashboard-clientes-chart-card');
  const legenda = card.getByRole('list', { name: 'Legenda da distribuição de clientes' });
  await expect(legenda.getByRole('listitem')).toHaveCount(1);
  await expect(legenda).toContainText('Pessoa Jurídica');
  await expect(legenda).toContainText('5 (100%)');
  await expect(card.getByText('Total:', { exact: false })).toContainText('5');
  await expect(card.locator('.recharts-pie-sector .recharts-sector')).toHaveCount(1);
  await assertNoDocumentOverflow(page);
});

test('sem clientes apresenta total zero sem NaN ou fatias', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await prepararPagina(page, [{ name: 'Pessoa Física', value: 0 }]);
  const card = page.getByTestId('dashboard-clientes-chart-card');
  await expect(card.getByText('Nenhum cliente para exibir.')).toBeVisible();
  await expect(card.getByText('Total:', { exact: false })).toContainText('0');
  await expect(card.locator('.recharts-pie-sector .recharts-sector')).toHaveCount(0);
  await expect(card.getByRole('list', { name: 'Legenda da distribuição de clientes' })).toHaveCount(0);
  await expect(card).not.toContainText(/NaN|Infinity/);
  await assertNoDocumentOverflow(page);
});

test('categoria não informada não é rotulada como jurídica', async ({ page }) => {
  await prepararPagina(page, [{ name: 'Não informado', value: 2 }, { name: 'Pessoa Física', value: 1 }]);
  const card = page.getByTestId('dashboard-clientes-chart-card');
  const legenda = card.getByRole('list', { name: 'Legenda da distribuição de clientes' });
  await expect(legenda).toContainText('Não informado');
  await expect(legenda).toContainText('2 (66,7%)');
  await expect(legenda).not.toContainText('Pessoa Jurídica');
  await assertNoDocumentOverflow(page);
});
