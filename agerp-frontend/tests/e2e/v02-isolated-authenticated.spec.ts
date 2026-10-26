import { expect, test, type APIRequestContext } from '@playwright/test';
import { randomBytes, randomUUID } from 'node:crypto';
import { execFile, execFileSync } from 'node:child_process';
import { request as httpRequest } from 'node:http';
import { promisify } from 'node:util';
import * as XLSX from 'xlsx';
import AxeBuilder from '@axe-core/playwright';

// This spec changes ONLY the explicitly isolated disposable database.
// Only explicitly verified, disposable local stacks may be used.
// Never store or log passwords/cookies/tokens.
const isolatedURL = process.env.E2E_ISOLATED_BASE_URL;
const candidateStack = isolatedURL === 'http://127.0.0.1:53992';
const adminLockStack = isolatedURL === 'http://127.0.0.1:53993';
const pgName = 'agerp-v02-pg-net-20261025-0025';
const backendName = adminLockStack ? 'agerp-v01-adminlock-backend-20261025'
  : candidateStack ? 'agerp-v01-backend-corrected-20261025' : 'agerp-v02-backend-20261025-0030';
const frontendName = adminLockStack ? 'agerp-v01-adminlock-nginx-20261025'
  : candidateStack ? 'agerp-v01-nginx-corrected-20261025' : 'agerp-v02-nginx-contrast-20261025';
const networkName = adminLockStack ? 'agerp-v01-adminlock-net-20261025-0510'
  : candidateStack ? 'agerp-v01-validation-net-20261025' : 'agerp-v02-isolated-net-20261025-0019';
const isolatedVolume = 'agerp-v02-netpg-data-20261025-0025';
const execFileAsync = promisify(execFile);
type Account = { email: string; nome: string; senha: string; perfil: 'ADMIN' | 'OPERADOR'; id?: number };
type Session = { id: string; active: boolean };
type NetworkMember = { Name: string };
type ContainerInfo = {
  Image: string;
  NetworkSettings: {
    Ports?: Record<string, { HostIp: string; HostPort: string }[] | null>;
    Networks: Record<string, { Aliases?: string[] }>;
  };
  Mounts: { Name?: string }[];
  Config: { Env: string[] };
};

test.use({ trace: 'off', screenshot: 'off', video: 'off' });

function docker(...args: string[]): string {
  return execFileSync('docker', args, { encoding: 'utf8', timeout: 15_000, windowsHide: true }).trim();
}

function sql(query: string): string {
  return docker('exec', pgName, 'psql', '-X', '-U', 'admin', '-d', 'agdb', '-v', 'ON_ERROR_STOP=1', '-Atc', query);
}

function verifyIsolation(): void {
  if (!['http://127.0.0.1:53990', 'http://127.0.0.1:53992', 'http://127.0.0.1:53993'].includes(isolatedURL ?? '')) {
    throw new Error('Only explicitly verified disposable loopback URLs are permitted');
  }
  const network = (JSON.parse(docker('network', 'inspect', networkName)) as { Internal: boolean; Containers?: Record<string, NetworkMember> }[])[0];
  const [postgres, backend, nginx, original] = JSON.parse(docker('inspect', pgName, backendName, frontendName, 'agerp-postgres')) as ContainerInfo[];
  const members = network.Containers ?? {};
  if ((!candidateStack && !adminLockStack && network.Internal !== true)
      || !Object.values(members).some((m) => m.Name === pgName)
      || Object.values(members).some((m) => ['agerp-postgres', 'agerp-app', 'agerp-frontend', 'agerp-python'].includes(m.Name))) {
    throw new Error('Test network contains an original service or isolated network mismatch');
  }
  if (original.NetworkSettings.Networks[networkName]) throw new Error('Original database shares the test network');
  if (postgres.NetworkSettings.Ports?.['5432/tcp']?.length) throw new Error('Isolated PostgreSQL port is published');
  if (postgres.Mounts.length !== 1 || postgres.Mounts[0].Name !== isolatedVolume) throw new Error('Isolated volume mismatch');
  if (postgres.Mounts.some((m) => original.Mounts.some((o) => m.Name && m.Name === o.Name))) throw new Error('Original volume shared');
  if (!postgres.NetworkSettings.Networks[networkName]?.Aliases?.includes('postgres')) throw new Error('Isolated postgres DNS alias mismatch');
  if (!backend.NetworkSettings.Networks[networkName] || backend.NetworkSettings.Ports?.['8080/tcp']?.length) throw new Error('Backend isolation mismatch');
  if (adminLockStack && backend.Image !== 'sha256:1b0ac55c99d4ef9326cb64cb3cf3ecd1a2a64e2069a338ba635ce1383851ba54') throw new Error('Patched backend candidate image mismatch');
  if (!backend.Config.Env.includes('SPRING_DATASOURCE_URL=jdbc:postgresql://postgres:5432/agdb')) throw new Error('Candidate JDBC destination mismatch');
  const published = nginx.NetworkSettings.Ports?.['80/tcp'];
  if (published?.length !== 1 || published[0].HostIp !== '127.0.0.1'
      || published[0].HostPort !== (adminLockStack ? '53993' : candidateStack ? '53992' : '53990')) throw new Error('Nginx publish address mismatch');
  if (!nginx.NetworkSettings.Networks[networkName]) throw new Error('Nginx is not connected to test stack');
  if (!sql("SELECT CASE WHEN current_database()='agdb' AND current_setting('server_version_num')::int/10000=16 THEN 'OK' ELSE 'NO' END").includes('OK')) throw new Error('Isolated database identity mismatch');
}

/** Verify the ZIP central directory and either 32- or 64-bit data descriptors.
 *  SheetJS 0.18.x warns on valid 64-bit descriptors when central sizes are small.
 *  The backend also verifies central-entry CRC and actual inflated sizes.
 */
function inspectXlsxZip(buffer: Buffer): { entries: number; zip64Descriptors: number } {
  let end = buffer.length - 22;
  while (end >= Math.max(0, buffer.length - 65_557) && buffer.readUInt32LE(end) !== 0x06054b50) end--;
  expect(end).toBeGreaterThanOrEqual(0);
  const entries = buffer.readUInt16LE(end + 10);
  let cursor = buffer.readUInt32LE(end + 16);
  let zip64Descriptors = 0;
  for (let i = 0; i < entries; i++) {
    expect(buffer.readUInt32LE(cursor), 'ZIP central file header').toBe(0x02014b50);
    const flags = buffer.readUInt16LE(cursor + 8);
    const compressed = buffer.readUInt32LE(cursor + 20);
    const uncompressed = buffer.readUInt32LE(cursor + 24);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localOffset = buffer.readUInt32LE(cursor + 42);
    expect(buffer.readUInt32LE(localOffset), 'ZIP local file header').toBe(0x04034b50);
    if (flags & 8) {
      let desc = localOffset + 30 + buffer.readUInt16LE(localOffset + 26)
        + buffer.readUInt16LE(localOffset + 28) + compressed;
      if (buffer.readUInt32LE(desc) === 0x08074b50) desc += 4;
      desc += 4; // CRC-32
      if (buffer.readUInt32LE(desc) === compressed && buffer.readUInt32LE(desc + 4) === uncompressed) {
        // Ordinary ZIP data descriptor.
      } else {
        expect(buffer.readBigUInt64LE(desc), 'ZIP64 compressed size').toBe(BigInt(compressed));
        expect(buffer.readBigUInt64LE(desc + 8), 'ZIP64 uncompressed size').toBe(BigInt(uncompressed));
        zip64Descriptors++;
      }
    }
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  expect(entries).toBeGreaterThan(0);
  return { entries, zip64Descriptors };
}

test.describe('V02 real authenticated Nginx, disposable users only', () => {
  test.skip(!isolatedURL, 'Explicitly opt in with E2E_ISOLATED_BASE_URL');
  test('signup, CSRF, sessions, RBAC, browser audit and parsed XLSX', async ({ playwright, browser }) => {
    test.setTimeout(180_000);
    verifyIsolation(); // Mandatory read-only identity and volume checks before the FIRST write.
    const idSuffix = randomUUID().replaceAll('-', '').slice(0, 16);
    const users: Account[] = [
      { email: `v02-admin-${idSuffix}@example.invalid`, nome: `V02 ADMIN ${idSuffix}`, senha: randomBytes(36).toString('base64url'), perfil: 'ADMIN' },
      { email: `v02-oper-${idSuffix}@example.invalid`, nome: `V02 OPERADOR ${idSuffix}`, senha: randomBytes(36).toString('base64url'), perfil: 'OPERADOR' },
    ];

    async function csrf(ctx: APIRequestContext): Promise<{ token: string; headerName: string }> {
      const r = await ctx.get('/api/auth/csrf');
      expect(r.status()).toBe(200);
      const data = await r.json();
      expect(data.headerName).toBe('X-XSRF-TOKEN');
      expect(data.token).toBeTruthy();
      return data;
    }
    async function mutation(ctx: APIRequestContext, verb: 'post' | 'delete', path: string, payload?: unknown) {
      const token = await csrf(ctx);
      return ctx[verb](path, { headers: { [token.headerName]: token.token }, ...(payload === undefined ? {} : { data: payload }) });
    }
    async function login(account: Account) {
      const ctx = await playwright.request.newContext({ baseURL: isolatedURL });
      const r = await mutation(ctx, 'post', '/api/auth/login', { email: account.email, senha: account.senha });
      expect(r.status(), `${account.perfil}: valid login`).toBe(200);
      expect((await ctx.storageState()).cookies.some((c) => c.name === 'jwtToken' && c.httpOnly)).toBe(true);
      expect((await ctx.get('/api/auth/me')).status()).toBe(200);
      return ctx;
    }

    const signup = await playwright.request.newContext({ baseURL: isolatedURL });
    let admin1: APIRequestContext | undefined;
    let admin2: APIRequestContext | undefined;
    let oper: APIRequestContext | undefined;
    try {
      // Public registration invokes the actual application's BCryptPasswordEncoder.
      for (const account of users) {
        const response = await mutation(signup, 'post', '/api/usuarios', { nome: account.nome, email: account.email, senha: account.senha, idPerfil: 2 });
        expect(response.status(), 'New pending synthetic account').toBe(201);
        const created = await response.json();
        expect(created.statusAcesso).toBe('PENDENTE');
        expect(Number.isSafeInteger(created.id)).toBe(true);
        // Only the two IDs just returned by our own isolated signup may be promoted.
        const result = sql(`WITH changed AS (UPDATE agerp.usuario SET ativo=true,status_acesso='APROVADO',id_perfil=(SELECT id_perfil FROM agerp.perfil WHERE nome='${account.perfil}') WHERE id_usuario=${created.id} AND email='${account.email}' AND status_acesso='PENDENTE' RETURNING id_usuario) SELECT id_usuario FROM changed`);
        expect(result).toBe(String(created.id));
        expect(sql(`SELECT CASE WHEN senha_hash LIKE '$2%' THEN 1 ELSE 0 END FROM agerp.usuario WHERE id_usuario=${created.id}`)).toBe('1');
        account.id = created.id;
      }

      admin1 = await login(users[0]);
      admin2 = await login(users[0]);
      oper = await login(users[1]);
      expect((await oper.get('/api/admin/logs')).status()).toBe(403);
      expect((await oper.get('/api/auth/admin/users/' + users[1].id + '/sessions')).status()).toBe(403);
      expect((await admin1.get('/api/admin/logs?page=0&size=5')).status()).toBe(200);
      expect((await admin1.get('/api/admin/perfis')).status()).toBe(200);

      const operatorBrowser = await browser.newContext({ baseURL: isolatedURL, storageState: await oper.storageState() });
      try {
        const operatorPage = await operatorBrowser.newPage();
        await operatorPage.goto('/admin');
        await expect(operatorPage).not.toHaveURL(/\/admin\/?$/);
        await expect(operatorPage.getByRole('heading', { name: 'Painel Administrativo' })).toHaveCount(0);
      } finally { await operatorBrowser.close(); }

      const sessions = await (await admin1.get('/api/auth/sessions')).json() as Session[];
      const active = sessions.filter((s) => s.active);
      expect(active).toHaveLength(2);
      const sessionId = active[0].id;
      const originalCookies = (await admin1.storageState()).cookies;
      await expect.poll(async () => (await admin1.get('/api/auth/me')).status()).toBe(200);
      expect((await mutation(admin1, 'post', '/api/auth/logout')).status()).toBe(200);
      expect((await admin1.get('/api/auth/me')).status()).toBe(401);
      // Replay the exact cookie from the logged-out browser, only in memory.
      const replay = await playwright.request.newContext({ baseURL: isolatedURL, storageState: { cookies: originalCookies, origins: [] } });
      try { expect((await replay.get('/api/auth/me')).status()).toBe(401); } finally { await replay.dispose(); }
      expect((await admin2.get('/api/auth/me')).status()).toBe(200);

      const adminSessions = await (await admin2.get('/api/auth/admin/users/' + users[1].id + '/sessions')).json() as Session[];
      const operatorSession = adminSessions.find((s) => s.active);
      expect(operatorSession).toBeTruthy();
      expect((await mutation(admin2, 'delete', `/api/auth/admin/users/${users[1].id}/sessions/${operatorSession!.id}`)).status()).toBe(204);
      expect((await oper.get('/api/auth/me')).status()).toBe(401);

      const newOperator = await login(users[1]);
      await oper.dispose();
      oper = newOperator;
      const clientName = `V02 HOMOLOG ${idSuffix}`;
      const clientResponse = await mutation(admin2, 'post', '/api/clientes', { nomeRazao: clientName, tipo: 'FISICA', email: `v02-cliente-${idSuffix}@example.invalid` });
      expect(clientResponse.status()).toBe(201);
      const newClient = await clientResponse.json();
      expect(Number.isSafeInteger(newClient.id)).toBe(true);
      const logsResp = await admin2.get('/api/admin/logs?page=0&size=100&sortBy=id&direction=desc');
      expect(logsResp.status()).toBe(200);
      const logs = (await logsResp.json()).content as Record<string, unknown>[];
      expect(Array.isArray(logs)).toBe(true);
      expect(logs.some((l: Record<string, unknown>) => JSON.stringify(l).includes(clientName) || (l.recursoId && String(l.recursoId) === String(newClient.id)))).toBe(true);
      const clientAudit = logs.find((l) => l.acao === 'CRIACAO_CLIENTE' && String(l.recursoId) === String(newClient.id));
      expect(clientAudit).toBeTruthy();
      expect(clientAudit?.entidade).toBe('CLIENTE');
      expect(clientAudit?.perfilUsuario).toBe('ADMIN');
      expect(clientAudit?.sessionRef).toBeTruthy();
      expect(clientAudit?.requestId).toBeTruthy();
      expect(clientAudit?.changesJson).toMatchObject({ tipo: { antes: null, depois: 'FISICA' } });
      for (const log of logs) {
        const raw = JSON.stringify(log).toLowerCase();
        expect(raw).not.toContain('senhahash');
        expect(raw).not.toContain('jwttoken');
        expect(raw).not.toContain(users[0].senha.toLowerCase());
        expect(raw).not.toContain(users[1].senha.toLowerCase());
      }

      // Genuine order -> inventory -> IA/fallback regression via the same
      // authenticated Nginx, using only newly created disposable records.
      const productResponse = await mutation(admin2, 'post', '/api/produtos', {
        nome: `V02 PRODUTO ${idSuffix}`, preco: 35.50, custo: 12.25,
        quantidadeInicial: 7, quantidadeMinima: 1, peso: 0.5,
      });
      expect(productResponse.status(), 'Create isolated product').toBe(201);
      const product = await productResponse.json() as { id: number; quantidadeAtual: number };
      expect(product.quantidadeAtual).toBe(7);

      const orderResponse = await mutation(admin2, 'post', '/api/pedidos', {
        idCliente: newClient.id, itens: [{ idProduto: product.id, quantidade: 2 }],
      });
      expect(orderResponse.status(), 'Create isolated order').toBe(201);
      const order = await orderResponse.json() as { id: number; status: string; valorTotal: number };
      expect(order.status).toBe('PENDENTE');
      expect(Number(order.valorTotal)).toBe(71);
      const stock = async () => {
        const r = await admin2!.get(`/api/produtos/${product.id}`);
        expect(r.status()).toBe(200);
        return (await r.json() as { quantidadeAtual: number }).quantidadeAtual;
      };
      expect(await stock()).toBe(7); // PENDENTE does not reserve inventory.

      const forecastResponse = await admin2.get(`/api/pedidos/${order.id}/previsao-entrega`, { timeout: 30_000 });
      expect(forecastResponse.status(), 'Real IA service or real fallback').toBe(200);
      const forecast = await forecastResponse.json() as { idPedido: number; status: string; prazoMinimoDias: number; prazoMaximoDias: number };
      expect(forecast.idPedido).toBe(order.id);
      expect(['SUCESSO', 'ESTIMATIVA_HEURISTICA']).toContain(forecast.status);
      expect(forecast.prazoMinimoDias).toBeGreaterThan(0);
      expect(forecast.prazoMaximoDias).toBeGreaterThanOrEqual(forecast.prazoMinimoDias);
      console.log(`V02_IA_ISOLATED result=${forecast.status}`);

      const confirmCsrf = await csrf(admin2);
      const confirmResponse = await admin2.patch(`/api/pedidos/${order.id}/status?status=CONFIRMADO`, {
        headers: { [confirmCsrf.headerName]: confirmCsrf.token },
      });
      expect(confirmResponse.status(), 'Confirm and debit 2 stock').toBe(200);
      expect((await confirmResponse.json()).status).toBe('CONFIRMADO');
      expect(await stock()).toBe(5);
      const cancelResponse = await mutation(admin2, 'post', `/api/pedidos/${order.id}/cancelar`);
      expect(cancelResponse.status(), 'Cancel and restore stock').toBe(200);
      expect((await cancelResponse.json()).status).toBe('CANCELADO');
      expect(await stock()).toBe(7);
      expect(Number(sql(`SELECT count(*) FROM agerp.movimentacao_estoque WHERE id_produto=${product.id} AND tipo IN ('SAIDA','ENTRADA')`))).toBe(2);

      // A04 must persist one correlated event per committed domain change,
      // including the real Python outcome. Rejected/rolled-back operations
      // are covered independently by the PostgreSQL transaction tests.
      const domainAudit = await admin2.get('/api/admin/logs?page=0&size=100&sortBy=id&direction=desc');
      expect(domainAudit.status()).toBe(200);
      const domainEvents = ((await domainAudit.json()).content as Record<string, unknown>[])
        .filter((l) => (l.entidade === 'PEDIDO' || l.entidade === 'ITEM_PEDIDO' || l.entidade === 'PREVISAO')
          && String(l.recursoId) === String(order.id));
      for (const action of ['CRIACAO_PEDIDO', 'ALTERACAO_ITEM_PEDIDO']) {
        expect(domainEvents.filter((l) => l.acao === action), action).toHaveLength(1);
      }
      expect(domainEvents.filter((l) => l.acao === 'ALTERACAO_STATUS_PEDIDO')).toHaveLength(2);
      const predictionAction = forecast.status === 'SUCESSO' ? 'CALCULO_PREVISAO_IA' : 'FALLBACK_PREVISAO_IA';
      expect(domainEvents.filter((l) => l.acao === predictionAction)).toHaveLength(1);
      const predictionAudit = domainEvents.find((l) => l.acao === predictionAction);
      expect(predictionAudit?.changesJson).toMatchObject({ status: { antes: null, depois: forecast.status } });
      expect(domainEvents.every((l) => Boolean(l.requestId && l.correlationId && l.sessionRef))).toBe(true);
      const stockAudit = await admin2.get(`/api/admin/logs?entidade=ESTOQUE&recursoId=${product.id}&size=50`);
      expect(stockAudit.status()).toBe(200);
      const stockEvents = (await stockAudit.json()).content as Record<string, unknown>[];
      for (const action of ['BAIXA_ESTOQUE_PEDIDO', 'ESTORNO_ESTOQUE_PEDIDO']) {
        const matching = stockEvents.filter((l) => l.acao === action && (l.changesJson as Record<string, unknown>)?.pedidoId);
        expect(matching, action).toHaveLength(1);
        expect(JSON.stringify(matching[0].changesJson)).toContain(String(order.id));
      }

      const productLogsResponse = await admin2.get(`/api/admin/logs?entidade=PRODUTO&recursoId=${product.id}&size=50`);
      expect(productLogsResponse.status()).toBe(200);
      const productLogs = (await productLogsResponse.json()).content as Record<string, unknown>[];
      expect(productLogs.some((l) => l.acao === 'CRIACAO_PRODUTO' && String(l.recursoId) === String(product.id))).toBe(true);

      const adminBrowser = await browser.newContext({ baseURL: isolatedURL, storageState: await admin2.storageState(), viewport: { width: 390, height: 844 } });
      try {
        const page = await adminBrowser.newPage();
        for (const width of [390, 1280]) {
          await page.setViewportSize({ width, height: 844 });
          await page.goto('/admin');
          await expect(page.getByRole('heading', { name: 'Painel Administrativo' })).toBeVisible();
          await page.getByRole('button', { name: /Logs do Sistema/ }).click();
          await expect(page.getByRole('heading', { name: 'Auditoria do Sistema' })).toBeVisible();
          await page.getByPlaceholder('Pesquisar nos campos selecionados').fill('CRIACAO_CLIENTE');
          await page.getByRole('button', { name: 'Pesquisar', exact: true }).click();
          await expect(page.locator(':text-is("CRIACAO_CLIENTE"):visible').first()).toBeVisible();
          await page.getByRole('button', { name: width < 768 ? 'Ver detalhes' : 'Ver', exact: true }).first().click();
          await expect(page.getByRole('dialog', { name: 'Detalhes do evento' })).toBeVisible();
          await page.getByRole('button', { name: 'Fechar detalhes' }).click();
          expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
          const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
          const problems = axe.violations.map((v) => ({ id: v.id, impact: v.impact, targets: v.nodes.map((n) => n.target) }));
          expect(problems, `WCAG 2 A/AA @${width}px`).toEqual([]);
        }
      } finally { await adminBrowser.close(); }

      // Bounded read-only HTTP load via real Nginx, not a production capacity claim.
      // Sample only the three proven-isolated containers while requests run.
      const latencies: number[] = [];
      const statusCounts = new Map<number, number>();
      const statsSamples: string[] = [];
      let loadFinished = false;
      const sampler = (async () => {
        while (!loadFinished && statsSamples.length < 4) {
          const { stdout } = await execFileAsync('docker', [
            'stats', '--no-stream', '--format', '{{.Name}}|{{.MemUsage}}|{{.CPUPerc}}',
            pgName, backendName, frontendName,
          ], { timeout: 15_000, windowsHide: true });
          statsSamples.push(stdout.trim().replaceAll(/\r?\n/g, ' ; '));
        }
      })();
      const startLoad = performance.now();
      try {
        await Promise.all(Array.from({ length: 5 }, async () => {
          for (let i = 0; i < 120; i++) {
            const start = performance.now();
            const response = await admin2.get('/api/admin/logs?page=0&size=20');
            latencies.push(performance.now() - start);
            statusCounts.set(response.status(), (statusCounts.get(response.status()) ?? 0) + 1);
          }
        }));
      } finally {
        loadFinished = true;
        await sampler;
      }
      expect([...statusCounts.entries()]).toEqual([[200, 600]]);
      expect(statsSamples.length).toBeGreaterThan(0);
      const ordered = latencies.sort((a, b) => a - b);
      const pct = (p: number) => ordered[Math.ceil(p * ordered.length) - 1].toFixed(2);
      console.log(`V02_HTTP_ISOLATED count=600 concurrency=5 durationMs=${(performance.now() - startLoad).toFixed(2)} p50Ms=${pct(.50)} p95Ms=${pct(.95)} p99Ms=${pct(.99)} errors=0`);
      statsSamples.forEach((sample, i) => console.log(`V02_STATS_ISOLATED sample=${i + 1} ${sample}`));

      const catalog = await admin2.get('/api/admin/relatorios');
      expect(catalog.status()).toBe(200);
      expect((await catalog.json()).length).toBe(39);
      async function checkWorkbook(path: string, shouldContainRow: boolean) {
        const response = await admin2.get(path, { timeout: 30_000 });
        expect(response.status()).toBe(200);
        expect(response.headers()['content-type']).toContain('spreadsheetml.sheet');
        expect(response.headers()['x-export-id']).toBeTruthy();
        const content = await response.body();
        const zip = inspectXlsxZip(content);
        console.log(`V02_XLSX_ZIP entries=${zip.entries} zip64Descriptors=${zip.zip64Descriptors}`);
        const workbook = XLSX.read(content, { type: 'buffer' });
        expect(workbook.SheetNames.length).toBeGreaterThan(0);
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1 }) as unknown[][];
        expect(rows.length).toBeGreaterThanOrEqual(1);
        if (shouldContainRow) expect(rows.length).toBeGreaterThan(1);
      }
      await checkWorkbook('/api/admin/relatorios/clientes_cadastro/xlsx', true);
      await checkWorkbook('/api/admin/relatorios/clientes_cadastro/xlsx?clienteId=999999999', false);
      await checkWorkbook(`/api/admin/relatorios/clientes_cadastro/xlsx?clienteId=${newClient.id}`, true);

      // Real export of its own event history: the current export must not be
      // included in the workbook, but its events must be written afterwards.
      const auditExport = await admin2.get('/api/admin/relatorios/auditoria_exportacoes/xlsx');
      expect(auditExport.status()).toBe(200);
      const auditExportId = auditExport.headers()['x-export-id'];
      expect(auditExportId).toMatch(/^[0-9a-f-]{36}$/i);
      const auditContent = await auditExport.body();
      const auditZip = inspectXlsxZip(auditContent);
      console.log(`V02_XLSX_ZIP entries=${auditZip.entries} zip64Descriptors=${auditZip.zip64Descriptors}`);
      const auditBook = XLSX.read(auditContent, { type: 'buffer' });
      const allExportRows = auditBook.SheetNames.flatMap((sheet) =>
        XLSX.utils.sheet_to_json(auditBook.Sheets[sheet], { header: 1 }) as unknown[][]);
      expect(allExportRows.length).toBeGreaterThan(1);
      expect(JSON.stringify(allExportRows)).not.toContain(auditExportId);
      await expect.poll(() => Number(sql(`SELECT count(*) FROM agerp.log_sistema WHERE entidade='RELATORIO' AND recurso_id='${auditExportId}' AND acao IN ('EXPORTACAO_SOLICITADA','EXPORTACAO_GERADA')`))).toBe(2);

      // Close a real HTTP client connection through Nginx before consuming the
      // response body. This proves cancellation at the client socket; Nginx may
      // buffer the completed server response, so the backend's terminal state
      // must NOT be interpreted as proof that the client received the XLSX.
      const cookieHeader = (await admin2.storageState()).cookies
        .filter((c) => c.name === 'jwtToken' || c.name === 'XSRF-TOKEN')
        .map((c) => `${c.name}=${c.value}`).join('; ');
      expect(cookieHeader).toContain('jwtToken=');
      const temporaryExports = () => Number(docker('exec', backendName, 'sh', '-c',
        "find /tmp -maxdepth 1 -type f -name 'agerp-relatorio-*.xlsx' | wc -l"));
      const beforeAbortTemporaryFiles = temporaryExports();
      const abortedExportId = await new Promise<string>((resolve, reject) => {
        const req = httpRequest(`${isolatedURL}/api/admin/relatorios/clientes_cadastro/xlsx`, {
          headers: { Cookie: cookieHeader },
        }, (res) => {
          try {
            expect(res.statusCode).toBe(200);
            const exportId = res.headers['x-export-id'];
            expect(exportId).toMatch(/^[0-9a-f-]{36}$/i);
            // Destroy before reading even one byte of the XLSX payload.
            res.destroy();
            resolve(exportId as string);
          } catch (error) { res.destroy(); reject(error); }
        });
        req.on('error', reject);
        req.end();
      });
      await expect.poll(() => Number(sql(`SELECT count(*) FROM agerp.log_sistema WHERE entidade='RELATORIO' AND recurso_id='${abortedExportId}' AND acao IN ('EXPORTACAO_TRANSMISSAO_ENCERRADA','EXPORTACAO_FALHA')`)), { timeout: 20_000 }).toBe(1);
      const abortedStates = sql(`SELECT acao FROM agerp.log_sistema WHERE entidade='RELATORIO' AND recurso_id='${abortedExportId}' AND acao IN ('EXPORTACAO_SOLICITADA','EXPORTACAO_GERADA','EXPORTACAO_TRANSMISSAO_ENCERRADA','EXPORTACAO_FALHA') ORDER BY id_log`);
      console.log(`V01_HTTP_ABORT socketClosedBeforeReadingBody=true states=${abortedStates.replaceAll(/\r?\n/g, ',')}`);
      // This checks temporary-file cleanup after the server-side stream. It does
      // NOT prove the Nginx-buffered response reached, or was cancelled at, the backend.
      await expect.poll(temporaryExports, { timeout: 15_000 }).toBe(beforeAbortTemporaryFiles);
      console.log(`V01_HTTP_ABORT tempFilesBefore=${beforeAbortTemporaryFiles} tempFilesAfter=${temporaryExports()} clientDeliveryUnverified=true`);

      const operatorSessions = await (await oper.get('/api/auth/sessions')).json() as Session[];
      const currentOperator = operatorSessions.find((s) => s.active);
      expect(currentOperator).toBeTruthy();
      // Simulate expiry of only the disposable operator session, not all sessions.
      expect(sql(`WITH changed AS (UPDATE agerp.sessao_autenticacao SET expira_em=now()-interval '1 minute' WHERE id='${currentOperator!.id}' AND id_usuario=${users[1].id} RETURNING id) SELECT id FROM changed`)).toBe(currentOperator!.id);
      expect((await oper.get('/api/auth/me')).status()).toBe(401);
      const blocked = await login(users[1]);
      await oper.dispose();
      oper = blocked;
      expect((await mutation(admin2, 'post', `/api/admin/usuarios/${users[1].id}/bloquear`)).status()).toBe(200);
      expect((await oper.get('/api/auth/me')).status()).toBe(401);
      const denied = await mutation(signup, 'post', '/api/auth/login', { email: users[1].email, senha: users[1].senha });
      expect(denied.status()).toBe(403);

      // Historical audit events must remain; new synthetic events are separate.
      expect(Number(sql("SELECT count(*) FROM agerp.log_sistema WHERE event_id IS NULL"))).toBeGreaterThanOrEqual(107);
      expect(Number(sql(`SELECT count(*) FROM agerp.sessao_autenticacao WHERE id_usuario IN (${users[0].id},${users[1].id})`))).toBeGreaterThanOrEqual(4);
      expect(sessionId).toBeTruthy();
    } finally {
      await Promise.all([signup, admin1, admin2, oper].filter((ctx): ctx is APIRequestContext => Boolean(ctx)).map((ctx) => ctx.dispose()));
    }
  });
});
