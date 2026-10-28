import { expect, test, type Page, type Route } from '@playwright/test';
import { ajustarViewportCss, assertNoDocumentOverflow } from './helpers';

const usuario = {
  id: 1, nome: 'Administrador', email: 'admin@exemplo.com', perfilNome: 'ADMIN',
  ativo: true, statusAcesso: 'APROVADO', trocaSenhaObrigatoria: false,
  nivelAutoridade: 100, paginas: ['DASHBOARD', 'CLIENTES', 'PRODUTOS', 'PEDIDOS', 'ADMIN'],
};

const clientes = Array.from({ length: 45 }, (_, i) => ({
  id: i + 1, tipo: 'FISICA', nomeRazao: i === 44 ? 'Alvo Cliente' : `Cliente ${i + 1}`,
  cpfCnpj: `00000000${String(i + 1).padStart(3, '0')}`, email: `cliente${i + 1}@exemplo.com`, telefone: '(14) 99999-9999',
}));
const produtos = Array.from({ length: 45 }, (_, i) => ({
  id: i + 1, nome: i === 44 ? 'Alvo Produto' : `Produto ${i + 1}`, descricao: 'Produto de teste',
  preco: 10, custo: 5, peso: 1, volume: 1, ativo: true, quantidadeAtual: 25,
  quantidadeMinima: 10, minimoAplicado: 10, estoqueBaixo: false, usarEstoqueMinimoGeral: false,
}));
const pedidos = Array.from({ length: 45 }, (_, i) => ({
  id: i + 1, idCliente: i + 1, nomeCliente: i === 44 ? 'Alvo Cliente' : `Cliente ${i + 1}`,
  idEndereco: 1, dataPedido: '2026-10-22T12:00:00', status: i === 44 ? 'ENTREGUE' : 'PENDENTE',
  valorTotal: 10, itens: [], idUsuario: 1, nomeUsuario: 'Administrador',
}));

function responder(route: Route, dados: unknown) {
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(dados) });
}

async function simularApi(page: Page) {
  await page.route('**/api/**', (route) => {
    const url = new URL(route.request().url());
    if (!url.pathname.startsWith('/api/')) return route.continue();
    if (url.pathname === '/api/auth/me') return responder(route, usuario);
    if (url.pathname === '/api/configuracoes/aparencia') return responder(route, { nomeEmpresa: 'AGERP' });
    if (url.pathname === '/api/clientes') return responder(route, clientes);
    if (url.pathname === '/api/produtos') return responder(route, produtos);
    if (url.pathname === '/api/pedidos') return responder(route, pedidos);
    return responder(route, {});
  });
}

const paginas = [
  { rota: '/clientes', nome: 'clientes', rotulo: 'Buscar clientes', titulo: 'Clientes', novo: '+ Novo Cliente' },
  { rota: '/produtos', nome: 'produtos', rotulo: 'Buscar produtos', titulo: 'Produtos', novo: '+ Novo Produto' },
  { rota: '/pedidos', nome: 'pedidos', rotulo: 'Buscar pedidos', titulo: 'Pedidos', novo: '+ Novo Pedido' },
] as const;

test.beforeEach(async ({ page }) => { await simularApi(page); });

for (const pagina of paginas) {
  test(`${pagina.titulo}: pesquisa acompanha rolagem e teclado no celular`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(pagina.rota);

    const scroller = page.getByTestId(`${pagina.nome}-scroll`);
    const cabecalho = page.locator('header');
    const topbar = page.getByTestId('authenticated-topbar');
    const busca = page.getByRole('textbox', { name: pagina.rotulo });
    const cards = page.getByRole('article');

    await expect(cards).toHaveCount(45);
    await expect(busca).toHaveCount(1);
    await expect(page.locator(`input[aria-label="${pagina.rotulo}"]`)).toHaveCount(1);
    await expect(scroller.getByRole('textbox', { name: pagina.rotulo })).toBeVisible();
    await expect(cabecalho.getByRole('textbox')).toBeHidden();
    await expect(topbar.getByRole('heading', { level: 1 })).toContainText(pagina.titulo);
    await expect(cabecalho.getByRole('button', { name: pagina.novo })).toBeVisible();
    await expect(cabecalho.getByRole('button', { name: /Atualizar/ })).toBeVisible();

    const antes = await cabecalho.boundingBox();
    await scroller.evaluate((el) => { el.scrollTop = 900; });
    await expect.poll(() => scroller.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
    const posicoes = await page.evaluate((nome) => {
      const area = document.querySelector(`[data-testid="${nome}-scroll"]`)!;
      const campo = area.querySelector('input')!;
      return { fimPesquisa: campo.getBoundingClientRect().bottom, inicioArea: area.getBoundingClientRect().top };
    }, pagina.nome);
    expect(posicoes.fimPesquisa).toBeLessThan(posicoes.inicioArea);
    const depois = await cabecalho.boundingBox();
    expect(Math.abs(depois!.y - antes!.y)).toBeLessThan(2);
    await expect(topbar.getByRole('heading', { level: 1 })).toBeVisible();

    await scroller.evaluate((el) => { el.scrollTop = 0; });
    await busca.focus();
    // Simula a redução da altura útil provocada pelo teclado virtual.
    await page.setViewportSize({ width: 390, height: 540 });
    await busca.fill('Alvo');
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toContainText('Alvo');
    await expect(busca).toBeFocused();
    await busca.fill('');
    await expect(cards).toHaveCount(45);
    await expect(scroller).toBeVisible();
    await assertNoDocumentOverflow(page);

    if (pagina.nome === 'pedidos') {
      await page.getByRole('combobox', { name: 'Filtrar pedidos por status' }).selectOption('ENTREGUE');
      await expect(cards).toHaveCount(1);
      await busca.fill('Nao existe');
      await expect(cards).toHaveCount(0);
      await busca.fill('');
      await expect(cards).toHaveCount(1);
    }
  });

  for (const largura of [640, 768, 1440]) {
    test(`${pagina.titulo}: campo permanece no cabeçalho em ${largura}px`, async ({ page }) => {
      await ajustarViewportCss(page, largura, 900);
      await page.goto(pagina.rota);

      const busca = page.getByRole('textbox', { name: pagina.rotulo });
      const header = page.locator('header');
      const scroll = page.getByTestId(`${pagina.nome}-scroll`);
      await expect(header.getByRole('textbox', { name: pagina.rotulo })).toBeVisible();
      await expect(scroll.getByRole('textbox')).toBeHidden();
      await expect(busca).toHaveCount(1);
      await expect(page.locator(`input[aria-label="${pagina.rotulo}"]`)).toHaveCount(1);
      await expect(header.getByRole('heading', { level: 1 })).toHaveText(new RegExp(pagina.titulo));
      await expect(header.getByRole('button', { name: pagina.novo })).toBeVisible();
      await busca.fill('Alvo');
      if (largura >= 768) {
        await expect(page.locator('tbody tr')).toHaveCount(1);
      } else {
        await expect(page.getByRole('article')).toHaveCount(1);
      }
      await busca.fill('');
      if (largura >= 768) {
        await expect(page.locator('tbody tr')).toHaveCount(45);
      } else {
        await expect(page.getByRole('article')).toHaveCount(45);
      }
      await assertNoDocumentOverflow(page);
    });
  }

  test(`${pagina.titulo}: busca e filtro persistem ao alternar entre celular e desktop`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(pagina.rota);
    const busca = page.getByRole('textbox', { name: pagina.rotulo });
    const campoNoDom = page.locator(`input[aria-label="${pagina.rotulo}"]`);
    await busca.fill('Alvo');
    await expect(page.getByRole('article')).toHaveCount(1);

    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(page.locator('header').getByRole('textbox', { name: pagina.rotulo })).toHaveValue('Alvo');
    await expect(campoNoDom).toHaveCount(1);
    await expect(page.locator('tbody tr')).toHaveCount(1);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByTestId(`${pagina.nome}-scroll`).getByRole('textbox', { name: pagina.rotulo })).toHaveValue('Alvo');
    await expect(campoNoDom).toHaveCount(1);
    await expect(page.getByRole('article')).toHaveCount(1);
  });
}
