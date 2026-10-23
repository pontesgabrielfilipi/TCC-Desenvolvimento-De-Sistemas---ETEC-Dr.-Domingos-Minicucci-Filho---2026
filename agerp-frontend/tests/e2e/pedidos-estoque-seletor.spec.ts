import { test, expect, type Route } from '@playwright/test';
import { assertNoDocumentOverflow } from './helpers';

const produtos = [
  { id: 1, nome: 'Componente industrial com nome muito longo que deve ser lido integralmente na seleção mesmo em telas estreitas', preco: 125.5, ativo: true, quantidadeAtual: 12, unidadeMedida: 'kg' },
  { id: 2, nome: 'Produto com estoque zerado', preco: 50, ativo: true, quantidadeAtual: 0 },
  { id: 3, nome: 'Produto sem informação de estoque', preco: 9, ativo: true, quantidadeAtual: null },
];

const responder = (route: Route, body: unknown) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

for (const viewport of [
  { nome: 'celular', width: 320, height: 568 },
  { nome: 'tablet', width: 768, height: 1024 },
  { nome: 'PC', width: 1440, height: 900 },
]) {
  test(`estoque positivo, zero e desconhecido no seletor em ${viewport.nome}`, async ({ page }) => {
    let consultasProdutos = 0;
    await page.route(/^https?:\/\/[^/]+\/api\//, async route => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/api/auth/me') return responder(route, { id: 1, nome: 'Administrador', email: 'admin@example.test', perfilNome: 'ADMIN', statusAcesso: 'APROVADO', ativo: true, paginas: ['PEDIDOS'], nivelAutoridade: 100 });
      if (path === '/api/configuracoes/aparencia') return responder(route, { nomeEmpresa: 'AGERP' });
      if (path === '/api/produtos') {
        consultasProdutos += 1;
        return responder(route, produtos);
      }
      if (path === '/api/pedidos' || path === '/api/clientes') return responder(route, []);
      return responder(route, []);
    });

    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/pedidos');
    await page.getByRole('button', { name: '+ Novo Pedido' }).click();
    const select = page.getByLabel('Produto 1');
    await expect(select).toBeEnabled();
    await expect(select.locator('option[value="1"]')).toContainText('Cód. #1');
    await expect(select.locator('option[value="1"]')).toContainText('R$');
    await expect(select.locator('option[value="1"]')).toContainText('Estoque: 12 kg');
    await expect(select.locator('option[value="2"]')).toContainText('Estoque: 0');
    await expect(select.locator('option[value="3"]')).toContainText('Estoque: não informado');
    // StrictMode consulta na montagem duas vezes, e o modal atualiza a lista uma vez.
    const consultasAntesDasSelecoes = consultasProdutos;
    expect(consultasAntesDasSelecoes).toBeGreaterThanOrEqual(1);
    expect(consultasAntesDasSelecoes).toBeLessThanOrEqual(3);

    await select.selectOption('1');
    const detalhe = page.locator('#estoque-produto-0');
    await expect(detalhe).toContainText(produtos[0].nome);
    await expect(detalhe).toContainText('Estoque: 12 kg');
    await assertNoDocumentOverflow(page);

    await select.focus();
    await select.press('ArrowDown');
    await expect(select).toHaveValue('2');
    await expect(detalhe).toContainText('Estoque: 0');
    await select.selectOption('3');
    await expect(detalhe).toContainText('Estoque: não informado');
    expect(consultasProdutos).toBe(consultasAntesDasSelecoes); // nenhuma consulta por produto selecionado
  });
}
