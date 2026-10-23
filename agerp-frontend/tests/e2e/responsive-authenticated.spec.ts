import { expect, test, type Page, type Route } from '@playwright/test';
import { assertNoDocumentOverflow } from './helpers';

const usuario = { id: 1, nome: 'Administrador Responsável com Nome Longo', email: 'administrador.responsavel@empresa-exemplo.com.br', perfilNome: 'ADMIN', ativo: true, statusAcesso: 'APROVADO', idPerfil: 1, trocaSenhaObrigatoria: false, nivelAutoridade: 100, paginas: ['DASHBOARD', 'CLIENTES', 'PRODUTOS', 'PEDIDOS', 'ADMIN'] };
const cliente = { id: 10, tipo: 'JURIDICA', nomeRazao: 'Empresa Cliente com Razão Social Muito Longa Ltda.', cpfCnpj: '12.345.678/0001-90', email: 'contato.comercial.muito.longo@cliente-exemplo.com.br', telefone: '(14) 99999-9999' };
const produto = { id: 20, nome: 'Produto industrial com descrição nominal muito extensa', descricao: 'Produto de teste', preco: 123456.78, custo: 98765.43, peso: 12.5, volume: 2.4, ativo: true, quantidadeAtual: 42, quantidadeMinima: 10, minimoAplicado: 15, usarEstoqueMinimoGeral: true, estoqueBaixo: false };
const pedido = { id: 30, idCliente: 10, nomeCliente: cliente.nomeRazao, idEndereco: 1, enderecoResumo: 'Avenida de Endereço Muito Longo, 1234, Centro, Botucatu - SP', dataPedido: '2026-10-21T12:00:00', status: 'PENDENTE', valorTotal: 246913.56, idUsuario: 1, nomeUsuario: usuario.nome, observacoes: 'Entregar na recepção principal.', itens: [{ id: 1, idProduto: 20, nomeProduto: produto.nome, quantidade: 2, precoUnitario: 123456.78, subtotal: 246913.56 }] };

const paginaVazia = { conteudo: [], totalElementos: 0, pagina: 0, tamanho: 10, totalPaginas: 0 };
const estatisticas = {
  usuarios: { total: 1, ativos: 1, pendentes: 0, bloqueados: 0, distribuicaoPerfis: [{ nome: 'ADMIN', quantidade: 1 }], desempenho: paginaVazia, movimentacoes: paginaVazia },
  clientes: { total: 1, comPedidos: 1, topFrequentes: paginaVazia, evolucao: [] },
  produtos: { total: 1, quantidadeVendida: 2, valorVendido: 246913.56, estoqueDisponivel: 42, estoqueBaixo: 0, topVendidos: paginaVazia },
  pedidos: { total: 1, pendentes: 1, emAndamento: 0, concluidos: 0, cancelados: 0, faturamento: 246913.56, ticketMedio: 246913.56, distribuicaoStatus: [{ nome: 'PENDENTE', quantidade: 1 }], evolucaoMensal: [{ periodo: '10/2026', quantidade: 1, valor: 246913.56 }] },
  filtrosDisponiveis: { statusPedidos: ['PENDENTE'], categoriasProduto: [] }, metadados: { regraFaturamento: 'Pedidos não cancelados' },
};

async function json(route: Route, body: unknown) {
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
}

async function mockApi(page: Page, authUser: Record<string, unknown> = usuario) {
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (!path.startsWith('/api/')) return route.continue();
    if (path === '/api/auth/me') return json(route, authUser);
    if (path === '/api/configuracoes/aparencia') return json(route, { nomeEmpresa: 'AGERP Empresa com Nome Extenso', exibirAlertasEstoque: true });
    if (path === '/api/clientes/10/enderecos') return json(route, [{ id: 1, idCliente: 10, logradouro: 'Avenida de Endereço Muito Longo', numero: '1234', bairro: 'Centro', cidade: 'Botucatu', estado: 'SP', cep: '18600-000' }]);
    if (path === '/api/clientes') return json(route, [cliente]);
    if (path === '/api/produtos') return json(route, [produto]);
    if (path === '/api/pedidos/30/previsao-entrega') return json(route, { idPedido: 30, prazoMinimoDias: 2, prazoMaximoDias: 6, estimativaCentralDias: 4, status: 'CALCULADO', cidadeOrigem: 'Botucatu', estadoOrigem: 'SP', cidadeDestino: 'São Paulo', estadoDestino: 'SP', distanciaKm: 230, dataCalculo: '2026-10-21T12:00:00', modeloVersao: 'rf-1.0', mensagem: 'Previsão calculada' });
    if (path === '/api/pedidos') return json(route, [pedido]);
    if (path === '/api/admin/usuarios') return json(route, [usuario]);
    if (path === '/api/admin/perfis') return json(route, [{ id: 1, nome: 'ADMIN', descricao: 'Administrador', nivelAutoridade: 100, paginas: ['DASHBOARD', 'CLIENTES', 'PRODUTOS', 'PEDIDOS'], protegido: true, versao: 1 }]);
    if (path === '/api/admin/logs') return json(route, { content: [{ id: 1, acao: 'ATUALIZACAO_COM_NOME_EXTENSO', entidade: 'PEDIDO', dataHora: '2026-10-21T12:00:00', ip: '2001:db8::1234', nomeUsuario: usuario.nome, emailUsuario: usuario.email, perfilUsuario: 'ADMIN', detalhes: 'Registro detalhado para inspeção responsiva.' }], number: 0, size: 20, totalElements: 1, totalPages: 1, first: true, last: true });
    if (path === '/api/admin/estatisticas') return json(route, estatisticas);
    if (path === '/api/admin/configuracoes') return json(route, { nomeEmpresa: 'AGERP', limiteEstoqueBaixo: 15, usarEstoqueMinimoGeral: true, exibirAlertasEstoque: true, timeoutIaMs: 3000, versao: 1, atualizadoEm: '2026-10-21T12:00:00' });
    if (path === '/api/admin/configuracoes/diagnostico') return json(route, { versaoSistema: '1.0', bancoDados: 'OK', servicoIa: 'OK', versaoModelo: 'rf-1.0', ultimaConfiguracao: '2026-10-21T12:00:00' });
    return json(route, {});
  });
}

test.beforeEach(async ({ page }) => mockApi(page));

for (const viewport of [
  { nome: 'celular', width: 390, height: 844 },
  { nome: 'tablet', width: 768, height: 1024 },
  { nome: 'PC', width: 1440, height: 900 },
]) {
test(`mínimo geral e individual persistem e aparecem nos produtos em ${viewport.nome}`, async ({ page }) => {
  let configuracao = { nomeEmpresa: 'AGERP', limiteEstoqueBaixo: 15, usarEstoqueMinimoGeral: true,
    exibirAlertasEstoque: true, timeoutIaMs: 3000, versao: 1, atualizadoEm: '2026-10-22T12:00:00' };
  const payloads: Array<{ usarEstoqueMinimoGeral: boolean; limiteEstoqueBaixo: number }> = [];
  await page.route('**/api/admin/configuracoes', async route => {
    if (route.request().method() === 'PUT') {
      const payload = route.request().postDataJSON();
      payloads.push(payload);
      configuracao = { ...configuracao, ...payload, versao: configuracao.versao + 1 };
    }
    return json(route, configuracao);
  });
  await page.route('**/api/produtos', async route => json(route, [{
    ...produto, quantidadeAtual: 9, quantidadeMinima: 5,
    minimoAplicado: configuracao.usarEstoqueMinimoGeral ? configuracao.limiteEstoqueBaixo : 5,
    estoqueBaixo: configuracao.usarEstoqueMinimoGeral,
    usarEstoqueMinimoGeral: configuracao.usarEstoqueMinimoGeral,
  }]));
  page.on('dialog', dialog => void dialog.accept());

    await page.setViewportSize(viewport);
    await page.goto('/admin');
    await page.getByRole('button', { name: /Configurações/ }).click();
    const chave = page.getByRole('checkbox', { name: /Usar estoque mínimo geral/ });
    await expect(chave).toBeChecked();
    await chave.uncheck();
    await page.getByRole('button', { name: 'Salvar alterações' }).click();
    await expect(page.getByText('Configurações salvas.', { exact: false })).toBeVisible();
    await expect(chave).not.toBeChecked();
    await assertNoDocumentOverflow(page);

    await page.goto('/produtos');
    const linha = viewport.width < 768 ? page.getByRole('article') : page.getByRole('row').filter({ hasText: produto.nome });
    await expect(linha).toContainText('5');
    await expect(linha).not.toContainText('Estoque baixo');
    await assertNoDocumentOverflow(page);

    await page.goto('/admin');
    await page.getByRole('button', { name: /Configurações/ }).click();
    await expect(chave).not.toBeChecked();
    await chave.check();
    await page.getByRole('button', { name: 'Salvar alterações' }).click();
    await expect(chave).toBeChecked();

    await page.goto('/produtos');
    const linhaGeral = viewport.width < 768 ? page.getByRole('article') : page.getByRole('row').filter({ hasText: produto.nome });
    await expect(linhaGeral).toContainText('15');
    await expect(linhaGeral).toContainText('Estoque baixo');
    await assertNoDocumentOverflow(page);
  expect(payloads.map(item => item.usarEstoqueMinimoGeral)).toEqual([false, true]);
  expect(payloads.every(item => item.limiteEstoqueBaixo === 15)).toBeTruthy();
});
}

test('estatísticas administrativas são recarregadas quando o modo de estoque muda', async ({ page }) => {
  let estoqueBaixo = 0;
  let consultas = 0;
  await page.route(/\/api\/admin\/estatisticas(?:\?|$)/, async route => {
    consultas++;
    return json(route, { ...estatisticas, produtos: { ...estatisticas.produtos, estoqueBaixo } });
  });

  await page.goto('/admin');
  await page.getByRole('button').filter({ hasText: 'Estatísticas' }).click();
  const indicador = page.getByRole('article', { name: 'Estoque baixo', exact: true });
  await expect(indicador).toContainText('0');

  const consultasAnteriores = consultas;
  estoqueBaixo = 2;
  await page.evaluate(() => window.dispatchEvent(new Event('agerp:configuracoes-atualizadas')));
  await expect.poll(() => consultas).toBeGreaterThan(consultasAnteriores);
  await expect(indicador).toContainText('2');
  expect(consultas).toBeGreaterThanOrEqual(2);
});

test('listagens e modais autenticados funcionam em 320 px', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 568 });

  await page.goto('/clientes');
  await expect(page.getByRole('heading', { name: cliente.nomeRazao })).toBeVisible();
  await expect(page.locator('table:visible')).toHaveCount(0);
  await page.getByRole('button', { name: '+ Novo Cliente' }).click();
  await expect(page.getByRole('dialog', { name: 'Novo Cliente' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Salvar' })).toBeVisible();
  await assertNoDocumentOverflow(page);
  await page.getByRole('button', { name: 'Cancelar' }).click();

  await page.goto('/produtos');
  await expect(page.getByRole('heading', { name: produto.nome })).toBeVisible();
  await page.getByRole('button', { name: '+ Novo Produto' }).click();
  await expect(page.getByRole('dialog', { name: 'Novo Produto' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Salvar' })).toBeVisible();
  await assertNoDocumentOverflow(page);
  await page.getByRole('button', { name: 'Cancelar' }).click();

  await page.goto('/pedidos');
  await expect(page.getByRole('heading', { name: cliente.nomeRazao })).toBeVisible();
  await page.getByRole('button', { name: 'Ver detalhes e IA' }).click();
  await expect(page.getByRole('dialog', { name: 'Pedido #30' })).toBeVisible();
  await expect(page.getByText('Estimativa Central')).toBeVisible();
  await expect(page.locator('p:visible').filter({ hasText: produto.nome })).toBeVisible();
  await assertNoDocumentOverflow(page);
  await page.screenshot({ path: testInfo.outputPath('pedidos-320x568.png'), fullPage: true });
  await page.getByRole('button', { name: 'Fechar', exact: true }).click();

  await page.unroute('**/api/**');
  await mockApi(page, { ...usuario, perfilNome: null, idPerfil: null });
  await page.goto('/sem-perfil');
  await expect(page.getByRole('heading', { name: 'Acesso Restrito' })).toBeVisible();
  await assertNoDocumentOverflow(page);

  await page.unroute('**/api/**');
  await mockApi(page, { ...usuario, trocaSenhaObrigatoria: true });
  await page.goto('/alterar-senha-obrigatoria');
  await expect(page.getByRole('heading', { name: 'Defina uma nova senha' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Salvar senha definitiva' })).toBeVisible();
  await assertNoDocumentOverflow(page);
});

test('admin adapta usuários, auditoria e estatísticas no mobile e tablet', async ({ page }, testInfo) => {
  for (const viewport of [{ width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1024, height: 768 }]) {
    await page.setViewportSize(viewport);
    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: 'Painel Administrativo' })).toBeVisible();
    await assertNoDocumentOverflow(page);

    await page.getByRole('button').filter({ hasText: 'Logs do Sistema' }).click();
    await expect(page.locator('h3:visible, td:visible').filter({ hasText: 'ATUALIZACAO_COM_NOME_EXTENSO' }).first()).toBeVisible();
    await assertNoDocumentOverflow(page);

    await page.getByRole('button').filter({ hasText: 'Estatísticas' }).click();
    await expect(page.getByText('Ticket médio')).toBeVisible();
    await assertNoDocumentOverflow(page);
    if (viewport.width === 390 || viewport.width === 768) await page.screenshot({ path: testInfo.outputPath(`admin-${viewport.width}x${viewport.height}.png`), fullPage: true });
  }
});
