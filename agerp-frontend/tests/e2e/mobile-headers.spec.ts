// Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
// Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.

import { expect, test, type Page, type Route } from '@playwright/test';
import { ajustarViewportCss, assertNoDocumentOverflow } from './helpers';

const usuario = {
  id: 1, nome: 'Administrador', email: 'admin@exemplo.com', perfilNome: 'ADMIN',
  ativo: true, statusAcesso: 'APROVADO', trocaSenhaObrigatoria: false,
  paginas: ['DASHBOARD', 'CLIENTES', 'PRODUTOS', 'PEDIDOS', 'ADMIN'],
};

const paginas = [
  { rota: '/dashboard', titulo: 'Dashboard' },
  { rota: '/clientes', titulo: '👥 Clientes' },
  { rota: '/produtos', titulo: '📦 Produtos' },
  { rota: '/pedidos', titulo: '📋 Pedidos' },
  { rota: '/admin', titulo: '🔧 Painel Administrativo', tituloOriginal: 'Painel Administrativo' },
];

const responder = (route: Route, data: unknown) => route.fulfill({
  status: 200, contentType: 'application/json', body: JSON.stringify(data),
});

async function simularApi(page: Page, onRefresh: () => void) {
  await page.route('**/api/**', route => {
    const url = new URL(route.request().url());
    if (!url.pathname.startsWith('/api/')) return route.continue();
    if (url.pathname === '/api/auth/me') return responder(route, usuario);
    if (url.pathname === '/api/configuracoes/aparencia') return responder(route, { nomeEmpresa: 'AGERP', exibirAlertasEstoque: true });
    if (url.pathname === '/api/dashboard/relatorio-completo') {
      if (url.searchParams.get('refresh') === 'true') onRefresh();
      return responder(route, {
        totalClientes: 0, totalProdutos: 0, vendasMes: 0, pedidosPendentes: 0,
        produtosEstoqueBaixo: 0, vendasMensais: [], topProdutos: [],
        distribuicaoClientes: [], statusPedidos: [], estoqueBaixo: [],
      });
    }
    if (['/api/clientes', '/api/produtos', '/api/pedidos', '/api/admin/usuarios', '/api/admin/perfis', '/api/admin/logs'].includes(url.pathname)) {
      return responder(route, []);
    }
    if (url.pathname === '/api/admin/estatisticas') return responder(route, {});
    return responder(route, {});
  });
}

for (const largura of [320, 390, 639, 640, 768, 1440]) {
  test(`cabeçalhos em ${largura}px: sem duplicação, espaço vazio ou overflow`, async ({ page }) => {
    let refreshes = 0;
    await simularApi(page, () => { refreshes++; });
    await ajustarViewportCss(page, largura);

    for (const { rota, titulo, tituloOriginal } of paginas) {
      await page.goto(rota);
      const topbar = page.getByTestId('authenticated-topbar');
      const menu = page.getByRole('button', { name: 'Abrir menu de navegação' });
      const tituloPrincipal = tituloOriginal ?? titulo;

      await expect(page.locator('h1:visible').filter({ hasText: tituloPrincipal })).toHaveCount(1);
      if (largura < 640) {
        await expect(topbar).toBeVisible();
        await expect(menu).toBeVisible();
        await expect(topbar.getByRole('heading', { level: 1 })).toHaveText(titulo);
        const [menuBox, titleBox] = await Promise.all([menu.boundingBox(), topbar.getByRole('heading').boundingBox()]);
        expect(menuBox && titleBox).toBeTruthy();
        expect(Math.abs((menuBox!.y + menuBox!.height / 2) - (titleBox!.y + titleBox!.height / 2))).toBeLessThan(4);
        expect(titleBox!.x).toBeGreaterThanOrEqual(menuBox!.x + menuBox!.width);
        expect(menuBox!.width).toBeGreaterThanOrEqual(44);
        expect(menuBox!.height).toBeGreaterThanOrEqual(44);
      } else if (largura < 1024) {
        await expect(topbar).toBeVisible();
        await expect(menu).toBeVisible();
        await expect(topbar.getByRole('heading')).toBeHidden();
      } else {
        await expect(topbar).toBeHidden();
        await expect(menu).toBeHidden();
      }

      if (rota === '/dashboard') {
        const mobileRefresh = topbar.getByRole('button', { name: 'Atualizar Dashboard' });
        if (largura < 640) {
          await expect(mobileRefresh).toBeVisible();
          await expect(mobileRefresh).toBeEnabled();
          const [barBox, refreshBox, titleBox] = await Promise.all([
            topbar.boundingBox(), mobileRefresh.boundingBox(), topbar.getByRole('heading').boundingBox(),
          ]);
          expect(Math.abs((refreshBox!.y + refreshBox!.height / 2) - (titleBox!.y + titleBox!.height / 2))).toBeLessThan(4);
          expect(barBox!.x + barBox!.width - refreshBox!.x - refreshBox!.width).toBeLessThanOrEqual(18);
          const before = refreshes;
          await mobileRefresh.click();
          await expect.poll(() => refreshes).toBeGreaterThan(before);
        } else {
          await expect(mobileRefresh).toBeHidden();
          await expect(page.locator('header').getByRole('button', { name: /Atualizar/ })).toBeVisible();
        }
      } else if (largura < 640) {
        if (rota === '/admin') {
          await expect(page.locator('header')).toBeHidden();
        } else {
          await expect(page.locator('header').getByRole('heading')).toBeHidden();
          await expect(page.locator('header').getByRole('textbox')).toBeHidden();
          await expect(page.getByTestId(`${rota.slice(1)}-scroll`).getByRole('textbox')).toBeVisible();
        }
      }
      await assertNoDocumentOverflow(page);
    }

    if (largura < 640) {
      await page.goto('/dashboard');
      const menu = page.getByRole('button', { name: 'Abrir menu de navegação' });
      await menu.click();
      await expect(menu).toHaveAttribute('aria-expanded', 'true');
      await page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('link', { name: 'Produtos' }).click();
      await expect(page).toHaveURL(/\/produtos$/);
      await expect(page.getByTestId('authenticated-topbar').getByRole('heading')).toHaveText('📦 Produtos');
      await expect(menu).toHaveAttribute('aria-expanded', 'false');
      await assertNoDocumentOverflow(page);
    }
  });
}
