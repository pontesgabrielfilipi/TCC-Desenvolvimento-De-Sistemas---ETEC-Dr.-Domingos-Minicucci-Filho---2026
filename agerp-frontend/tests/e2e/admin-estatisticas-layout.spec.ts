import { expect, test, type Page, type Route } from '@playwright/test';
import { assertNoDocumentOverflow } from './helpers';

const quantidadeClientes = 60;
const nomesClientes = Array.from({ length: quantidadeClientes }, (_, indice) =>
    `Cliente ${String(indice + 1).padStart(2, '0')} — Distribuidora de Equipamentos Industriais e Peças de Reposição ${'Extra'.repeat(4)}`,
);
const pagina = <T>(conteudo: T[]) => ({ conteudo, totalElementos: conteudo.length, pagina: 0, tamanho: 10, totalPaginas: 1 });

async function mockEstatisticas(page: Page) {
    await page.route('**/api/**', async (route: Route) => {
        const path = new URL(route.request().url()).pathname;
        if (!path.startsWith('/api/')) return route.continue();
        let data: unknown = {};
        if (path === '/api/auth/me') data = {
            id: 1, nome: 'Administrador', email: 'admin@agerp.local', perfilNome: 'ADMIN',
            ativo: true, statusAcesso: 'APROVADO', trocaSenhaObrigatoria: false,
            paginas: ['DASHBOARD', 'ADMIN'], nivelAutoridade: 100,
        };
        if (path === '/api/configuracoes/aparencia') data = { nomeEmpresa: 'AGERP', exibirAlertasEstoque: true };
        if (path === '/api/admin/usuarios' || path === '/api/clientes') data = [];
        if (path === '/api/admin/estatisticas') data = {
            usuarios: {
                total: 3, ativos: 3, pendentes: 0, bloqueados: 0, distribuicaoPerfis: [],
                desempenho: pagina([{ id: 1, nome: 'Operador com nome muito extenso', pedidos: 45, faturamento: 3000 }]),
                movimentacoes: pagina([{ id: 1, nome: 'Operador responsável pelas movimentações de estoque e almoxarifado', movimentacoes: 53, quantidadeEntrada: 31, quantidadeSaida: 22 }]),
            },
            clientes: {
                total: quantidadeClientes, comPedidos: quantidadeClientes, topFrequentes: pagina([]),
                evolucao: nomesClientes.flatMap((nome, indice) => ['2026-08', '2026-09', '2026-10'].map((periodo, mes) =>
                    ({ periodo, id: indice + 1, nome, pedidos: 1 + (indice + mes) % 10, faturamento: 100 }))),
            },
            produtos: { total: 2, quantidadeVendida: 10, valorVendido: 1000, estoqueDisponivel: 20, estoqueBaixo: 0, topVendidos: pagina([]) },
            pedidos: {
                total: 180, pendentes: 10, emAndamento: 20, concluidos: 150, cancelados: 0,
                faturamento: 3000, ticketMedio: 16.67, distribuicaoStatus: [], evolucaoMensal: [],
            },
            filtrosDisponiveis: { statusPedidos: [], categoriasProduto: [] }, metadados: {},
        };
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
    });
}

test('60 clientes e nomes longos: gráficos, legendas e tabela ficam isolados em cada viewport', async ({ page }, testInfo) => {
    test.setTimeout(150_000);
    await mockEstatisticas(page);
    await page.goto('/admin');
    await page.getByRole('button', { name: /Estatísticas/ }).click();

    const card = page.getByRole('region', { name: 'Evolução de pedidos por cliente' });
    const plot = card.getByTestId('client-orders-plot');
    const legend = card.getByRole('group', { name: 'Legenda dos clientes' });
    const tableRegion = page.getByRole('region', { name: 'Tabela de movimentações de estoque por usuário' });
    await expect(card).toBeVisible();
    await expect(legend.getByRole('button')).toHaveCount(quantidadeClientes);
    await expect(card.getByText('Clientes no gráfico (60)')).toBeVisible();
    await expect(tableRegion.getByRole('columnheader')).toHaveCount(4);

    for (const width of [320, 360, 390, 430, 768, 1024, 1280, 1440, 1920]) {
        await page.setViewportSize({ width, height: 900 });
        await page.evaluate(() => document.fonts.ready);
        await expect.poll(() => plot.locator('.recharts-surface').count()).toBe(1);

        const positions = await page.evaluate(() => {
            const card = document.querySelector('[aria-labelledby="evolucao-clientes-titulo"]')!;
            const plot = card.querySelector('[data-testid="client-orders-plot"]')!;
            const legend = card.querySelector('[data-testid="client-orders-legend"]')!;
            const title = document.getElementById('evolucao-clientes-titulo')!;
            const nextTable = document.querySelector('[aria-labelledby="movimentacoes-usuarios-titulo"]')!;
            const rect = (element: Element) => element.getBoundingClientRect();
            const cardBox = rect(card), plotBox = rect(plot), legendBox = rect(legend), titleBox = rect(title), tableBox = rect(nextTable);
            return {
                titleClear: titleBox.bottom < plotBox.top,
                legendBelowPlot: plotBox.bottom <= legendBox.top,
                legendInsideCard: legendBox.bottom <= cardBox.bottom && legendBox.right <= cardBox.right + 1,
                tableBelowCard: cardBox.bottom <= tableBox.top + 1,
                plotUsable: plotBox.width >= 180 && plotBox.height >= 280,
                legendScrollable: legend.scrollHeight > legend.clientHeight,
                tableLocalScroll: (() => {
                    const region = document.querySelector('[aria-label="Tabela de movimentações de estoque por usuário"]')!;
                    return region.scrollWidth > region.clientWidth && getComputedStyle(region).overflowX === 'auto';
                })(),
                headersSeparated: (() => {
                    const headers = [...document.querySelectorAll('[aria-label="Tabela de movimentações de estoque por usuário"] th')];
                    return headers.every((header, index) => index === 0 || rect(headers[index - 1]).right <= rect(header).left + 1)
                        && headers.every(header => parseFloat(getComputedStyle(header).paddingLeft) >= 12);
                })(),
            };
        });
        expect(positions.titleClear, `Título invadido em ${width}px`).toBe(true);
        expect(positions.legendBelowPlot, `Legenda invadiu gráfico em ${width}px`).toBe(true);
        expect(positions.legendInsideCard, `Legenda saiu do card em ${width}px`).toBe(true);
        expect(positions.tableBelowCard, `Card invadiu tabela em ${width}px`).toBe(true);
        expect(positions.plotUsable, `Área útil insuficiente em ${width}px`).toBe(true);
        expect(positions.legendScrollable, `Legenda não tem rolagem em ${width}px`).toBe(true);
        expect(positions.headersSeparated, `Cabeçalhos colados em ${width}px`).toBe(true);
        if (width <= 430) expect(positions.tableLocalScroll, `Tabela não tem rolagem local em ${width}px`).toBe(true);
        await assertNoDocumentOverflow(page);
        if ([320, 768, 1280, 1920].includes(width)) {
            await card.screenshot({ path: testInfo.outputPath(`clientes-60-${width}px.png`) });
            await tableRegion.screenshot({ path: testInfo.outputPath(`movimentacoes-${width}px.png`) });
        }
    }

    // O último cliente permanece acessível, e a interação preserva as demais séries.
    const ultimo = legend.getByRole('button', { name: nomesClientes[59] });
    await ultimo.scrollIntoViewIfNeeded();
    await expect(ultimo).toBeVisible();
    await ultimo.click();
    await expect(ultimo).toHaveAttribute('aria-pressed', 'false');
    await expect(legend.getByRole('button', { name: nomesClientes[0] })).toHaveAttribute('aria-pressed', 'true');
    await card.getByRole('button', { name: 'Mostrar todos' }).click();
    await expect(ultimo).toHaveAttribute('aria-pressed', 'true');
});
