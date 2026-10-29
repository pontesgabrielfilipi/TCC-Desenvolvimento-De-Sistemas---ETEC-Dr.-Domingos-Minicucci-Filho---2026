// Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
// Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.

import { expect, test } from '@playwright/test';
import { assertNoDocumentOverflow } from './helpers';

const meses = ['05/2026', '06/2026', '07/2026', '08/2026', '09/2026', '10/2026'];
const escalas = {
  pequenas: [0, 15, 50, 120, 300, 890],
  milhares: [500, 1250, 7800, 18000, 75000, 128000],
  milhoes: [500000, 1234567, 25500000, 85000000, 350000000, 950000000],
  trilhoes: [5000000000, 123456789000, 950000000000, 1100000000000, 5500000000000, 12000000000000],
};
const larguras = [320, 375, 430, 600, 768, 900, 1024, 1180, 1440];

for (const [escala, valores] of Object.entries(escalas)) {
test(`eixo Y das vendas: ${escala} em celular, tablet, PC e larguras intermediárias`, async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  let leituras = 0;

  await page.route('**/api/auth/me', route => route.fulfill({
    json: { id: 1, nome: 'Teste', email: 'teste@agerp.local', perfilNome: 'ADMIN', paginas: ['DASHBOARD', 'CLIENTES', 'PRODUTOS', 'PEDIDOS', 'ADMIN'], ativo: true, statusAcesso: 'APROVADO', trocaSenhaObrigatoria: false },
  }));
  await page.route('**/api/configuracoes/aparencia', route => route.fulfill({ json: { nomeEmpresa: 'AGERP', exibirAlertasEstoque: false } }));
  await page.route('**/api/dashboard/relatorio-completo*', route => {
    leituras++;
    return route.fulfill({ json: {
      totalClientes: 12,
      totalProdutos: 20,
      vendasMes: valores[5],
      pedidosPendentes: 2,
      produtosEstoqueBaixo: 0,
      vendasMensais: meses.map((mes, index) => ({ mes, valor: valores[index] })),
      topProdutos: [],
      distribuicaoClientes: [],
      statusPedidos: [],
      estoqueBaixo: [],
    } });
  });

    for (const width of larguras) {
      await page.setViewportSize({ width, height: width < 600 ? 844 : 900 });
      await page.goto('/dashboard');
      const card = page.getByTestId('dashboard-vendas-chart-card');
      await expect(card.locator('.recharts-yAxis-tick-labels text').first()).toBeVisible();

      const dimensoes = await card.evaluate(element => {
        const chart = element.querySelector('.recharts-responsive-container svg');
        const gridLine = chart?.querySelector('.recharts-cartesian-grid-horizontal line');
        const yLabels = [...(chart?.querySelectorAll('.recharts-yAxis-tick-labels text') ?? [])];
        const xLabels = [...(chart?.querySelectorAll('.recharts-xAxis-tick-labels text') ?? [])];
        if (!chart || !gridLine || !yLabels.length || !xLabels.length) throw new Error('Eixos e área de plotagem precisam ser exibidos.');
        const svg = chart.getBoundingClientRect();
        const card = element.getBoundingClientRect();
        return {
          plotWidth: Math.abs(Number(gridLine.getAttribute('x2')) - Number(gridLine.getAttribute('x1'))),
          labelsY: yLabels.map(label => ({ text: label.textContent?.replace(/\s/g, ' ').trim(), rect: label.getBoundingClientRect().toJSON() })),
          labelsX: xLabels.map(label => ({ text: label.textContent?.trim(), rect: label.getBoundingClientRect().toJSON() })),
          svg: svg.toJSON(),
          card: card.toJSON(),
        };
      });

      expect(dimensoes.plotWidth, `Área útil do gráfico: ${escala}, ${width}px`).toBeGreaterThan(60);
      expect(dimensoes.labelsX[0].text).toBe(meses[0]);
      expect(dimensoes.labelsX.at(-1)?.text).toBe(meses.at(-1));
      for (const label of dimensoes.labelsY) {
        expect(label.text, `Rótulo monetário em ${escala}, ${width}px`).toMatch(/^R\$/);
        expect(label.rect.left, `Rótulo Y cortado em ${escala}, ${width}px: ${label.text}`).toBeGreaterThanOrEqual(dimensoes.svg.left - 1);
        expect(label.rect.right).toBeLessThanOrEqual(dimensoes.svg.right + 1);
        expect(label.rect.left).toBeGreaterThanOrEqual(dimensoes.card.left);
      }
      for (const label of dimensoes.labelsX) {
        expect(label.rect.left, `Mês cortado em ${escala}, ${width}px`).toBeGreaterThanOrEqual(dimensoes.svg.left - 1);
        expect(label.rect.right).toBeLessThanOrEqual(dimensoes.svg.right + 1);
      }
      await assertNoDocumentOverflow(page);

      if (escala === 'trilhoes' && [320, 768, 1440].includes(width)) {
        await card.screenshot({ path: testInfo.outputPath(`vendas-${width}px.png`) });
      }
    }
  // O eixo é abreviado, mas os pontos e o tooltip mantêm os valores reais.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/dashboard');
  const card = page.getByTestId('dashboard-vendas-chart-card');
  await card.locator('.recharts-line-dots .recharts-dot').last().hover({ force: true });
  await expect(card.locator('.recharts-tooltip-wrapper')).toContainText(
    valores.at(-1)!.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
  );

  const antes = leituras;
  await page.getByRole('button', { name: /Atualizar/ }).click();
  await expect.poll(() => leituras).toBeGreaterThan(antes);
  await expect(card.locator('.recharts-yAxis-tick-labels text').first()).toBeVisible();
});
}
