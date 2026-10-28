import { expect, test, type APIRequestContext } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { request as httpRequest } from 'node:http';
import { crc32, inflateRawSync } from 'node:zlib';
import * as XLSX from 'xlsx';
import AxeBuilder from '@axe-core/playwright';

// OPT-IN EXPLÍCITO. Este teste grava dados sintéticos no agdb do Compose DE TESTE existente.
// Nunca apaga registros e não pode apontar para produção. Segredos ficam apenas na memória
// do processo, sem capturas de tela, traces ou vídeos.
const origin = 'http://127.0.0.1:5173';
const enabled = process.env.E2E_TEST_DEPLOY_AUTH === 'I_AUTHORIZE_TEST_ACCOUNTS'
  && process.env.E2E_BASE_URL === origin;
const project = 'tcc-desenvolvimento-de-sistemas---etec-dr-domingos-minicucci-filho---2026';
const imageIds = {
  'agerp-app': 'sha256:8b298958a1f5a088f5c782253e53cab0cf7c1ee854c18a446418242e2c82d418',
  'agerp-frontend': 'sha256:0762bc7a153edee23deb5dc656524caba47a37321a177e1ddabbcf733cb07606',
  'agerp-python': 'sha256:e6ddcc88671d1d193660fa8e5f10e7f7a145c39fc1f19ad674a63f7dc5477d46',
};
type Account = { id?: number; email: string; nome: string; senha: string };
type Session = { id: string; active: boolean };
test.use({ trace: 'off', screenshot: 'off', video: 'off' });

function docker(...args: string[]): string {
  return execFileSync('docker', args, { encoding: 'utf8', timeout: 15_000, windowsHide: true }).trim();
}
function sql(statement: string): string {
  return docker('exec', 'agerp-postgres', 'psql', '-X', '-U', 'admin', '-d', 'agdb', '-v', 'ON_ERROR_STOP=1', '-Atc', statement);
}

function verifyTarget(): void {
  const containers = JSON.parse(docker('inspect', 'agerp-postgres', 'agerp-app', 'agerp-frontend', 'agerp-python')) as Array<{
    Name: string; Image: string;
    Config: { Labels: Record<string, string>; Env: string[] };
    State: { Running: boolean };
    Mounts: Array<{ Name?: string }>;
    NetworkSettings: { Ports: Record<string, Array<{ HostIp: string; HostPort: string }> | null> };
  }>;
  const services = ['postgres', 'backend-api', 'frontend', 'python-ia-api'];
  for (let i = 0; i < containers.length; i++) {
    const c = containers[i];
    if (c.Config.Labels['com.docker.compose.project'] !== project
      || c.Config.Labels['com.docker.compose.service'] !== services[i]
      || !c.State.Running) throw new Error('Compose mismatch; no writes performed');
    const expectedImage = imageIds[c.Name.replace(/^\//, '') as keyof typeof imageIds];
    if (expectedImage && c.Image !== expectedImage) throw new Error('Candidate image changed; no writes performed');
  }
  if (!containers[0].Mounts.some((m) => m.Name === `${project}_pgdata`)) throw new Error('Postgres volume mismatch');
  if (!containers[1].Config.Env.includes('SPRING_DATASOURCE_URL=jdbc:postgresql://postgres:5432/agdb')) {
    throw new Error('Backend JDBC mismatch; no writes performed');
  }
  const published = containers[2].NetworkSettings.Ports['80/tcp'];
  if (published?.length !== 1 || published[0].HostIp !== '127.0.0.1'
      || published[0].HostPort !== '5173') throw new Error('Nginx loopback address mismatch');
  if (sql("SELECT CASE WHEN current_database()='agdb' AND current_setting('server_version_num')::int/10000=16 THEN 'OK' ELSE 'BAD' END") !== 'OK') {
    throw new Error('Database identity mismatch; no writes performed');
  }
}

// O leitor ZIP independente valida, nos bytes implantados, tamanho descompactado e CRC
// de cada entrada, não apenas a assinatura PK ou o parsing do SheetJS.
function verifyZipWithNode(bytes: Buffer): { entries: number; dataDescriptors: number } {
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (bytes.readUInt32LE(i) === 0x06054b50 && i + 22 + bytes.readUInt16LE(i + 20) === bytes.length) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('ZIP end-of-central-directory missing');
  const entries = bytes.readUInt16LE(eocd + 10);
  let offset = bytes.readUInt32LE(eocd + 16);
  if (entries === 0xffff || offset === 0xffffffff) throw new Error('ZIP64 central index not supported by test reader');
  let dataDescriptors = 0;
  for (let i = 0; i < entries; i++) {
    if (bytes.readUInt32LE(offset) !== 0x02014b50) throw new Error(`ZIP central entry ${i} missing`);
    const flags = bytes.readUInt16LE(offset + 8);
    const method = bytes.readUInt16LE(offset + 10);
    const expectedCrc = bytes.readUInt32LE(offset + 16);
    const compressedSize = bytes.readUInt32LE(offset + 20);
    const uncompressedSize = bytes.readUInt32LE(offset + 24);
    const nameLength = bytes.readUInt16LE(offset + 28);
    const extraLength = bytes.readUInt16LE(offset + 30);
    const commentLength = bytes.readUInt16LE(offset + 32);
    const local = bytes.readUInt32LE(offset + 42);
    if ([compressedSize, uncompressedSize, local].includes(0xffffffff)) {
      throw new Error(`ZIP64 sizes require extended reader at entry ${i}`);
    }
    if (bytes.readUInt32LE(local) !== 0x04034b50) throw new Error(`ZIP local entry ${i} missing`);
    const localFlags = bytes.readUInt16LE(local + 6);
    if (localFlags !== flags) throw new Error(`ZIP entry ${i} flags disagree`);
    const start = local + 30 + bytes.readUInt16LE(local + 26) + bytes.readUInt16LE(local + 28);
    const packed = bytes.subarray(start, start + compressedSize);
    if (packed.length !== compressedSize) throw new Error(`ZIP entry ${i} truncated`);
    const plain = method === 8 ? inflateRawSync(packed) : method === 0 ? packed : null;
    if (!plain || plain.length !== uncompressedSize || crc32(plain) !== expectedCrc) {
      throw new Error(`ZIP entry ${i} invalid size, compression or CRC`);
    }
    // O bit 3 permite tamanho e CRC zerados no cabeçalho local; o diretório central contém
    // os valores oficiais. O SheetJS 0.18.5 alerta mesmo para essas entradas válidas.
    if ((flags & 0x8) && bytes.readUInt32LE(local + 22) === 0) dataDescriptors++;
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return { entries, dataDescriptors };
}

test.describe('V02 authenticated real TEST deploy — no mocks', () => {
  test.skip(!enabled, 'Requires explicit E2E_TEST_DEPLOY_AUTH opt-in and exact E2E_BASE_URL');

  test('ADMIN/OPERADOR, revocation, stock, Python, audits, parsed XLSX, cleanup', async ({ playwright, browser }) => {
    test.setTimeout(210_000);
    verifyTarget(); // Confere a identidade do alvo em modo somente leitura antes de qualquer escrita.
    const suffix = randomUUID().replaceAll('-', '').slice(0, 14);
    const admin: Account = {
      email: `v02-deploy-admin-${suffix}@example.invalid`, nome: `V02 ADMIN ${suffix}`,
      senha: randomBytes(36).toString('base64url'),
    };
    const operator: Account = {
      email: `v02-deploy-operator-${suffix}@example.invalid`, nome: `V02 OPERADOR ${suffix}`,
      senha: randomBytes(36).toString('base64url'),
    };
    const registration = await playwright.request.newContext({ baseURL: origin });
    let admin1: APIRequestContext | undefined;
    let admin2: APIRequestContext | undefined;
    let oper: APIRequestContext | undefined;
    const resources: Record<string, number> = {};
    const cleanupErrors: string[] = [];
    let cleanupError: Error | undefined;

    async function csrf(ctx: APIRequestContext) {
      const r = await ctx.get('/api/auth/csrf');
      expect(r.status()).toBe(200);
      const data = await r.json() as { token: string; headerName: string };
      expect(data.headerName).toBe('X-XSRF-TOKEN');
      expect(data.token).toBeTruthy();
      return data;
    }
    async function mutate(ctx: APIRequestContext, method: 'post' | 'delete' | 'put', path: string, data?: unknown) {
      const xsrf = await csrf(ctx);
      return ctx[method](path, { headers: { [xsrf.headerName]: xsrf.token }, ...(data === undefined ? {} : { data }) });
    }
    async function login(user: Account) {
      const ctx = await playwright.request.newContext({ baseURL: origin });
      try {
        expect((await mutate(ctx, 'post', '/api/auth/login', { email: user.email, senha: user.senha })).status()).toBe(200);
        const cookies = (await ctx.storageState()).cookies;
        expect(cookies.some((c) => c.name === 'jwtToken' && c.httpOnly && !c.secure)).toBe(true);
        expect((await ctx.get('/api/auth/me')).status()).toBe(200);
        return ctx;
      } catch (err) { await ctx.dispose(); throw err; }
    }
    async function signup(user: Account) {
      const r = await mutate(registration, 'post', '/api/usuarios', {
        nome: user.nome, email: user.email, senha: user.senha, idPerfil: 2,
      });
      expect(r.status(), 'Public registration must stay PENDENTE').toBe(201);
      const created = await r.json() as { id: number; statusAcesso: string };
      expect(created.statusAcesso).toBe('PENDENTE');
      expect(Number.isSafeInteger(created.id) && created.id > 0).toBe(true);
      user.id = created.id;
    }
    function deactivateOwnUser(user: Account) {
      if (!user.id) return;
      const updated = sql(`WITH changed AS (UPDATE agerp.usuario SET ativo=false,status_acesso='BLOQUEADO',credential_version=COALESCE(credential_version,0)+1 WHERE id_usuario=${user.id} AND email='${user.email}' AND status_acesso='APROVADO' RETURNING id_usuario) SELECT id_usuario FROM changed`);
      if (updated !== String(user.id) && sql(`SELECT CASE WHEN ativo=false AND status_acesso IN ('PENDENTE','BLOQUEADO') THEN 'OK' ELSE 'BAD' END FROM agerp.usuario WHERE id_usuario=${user.id} AND email='${user.email}'`) !== 'OK') {
        throw new Error('Synthetic account not disabled');
      }
    }

    try {
      await signup(admin);
      // Reutiliza o bootstrap protegido de um ADMIN do E2E isolado. O BCrypt foi gerado
      // por /api/usuarios, nunca por SQL.
      const provisioned = sql(`WITH changed AS (UPDATE agerp.usuario SET ativo=true,status_acesso='APROVADO',id_perfil=(SELECT id_perfil FROM agerp.perfil WHERE nome='ADMIN') WHERE id_usuario=${admin.id} AND email='${admin.email}' AND status_acesso='PENDENTE' AND ativo=false RETURNING id_usuario) SELECT id_usuario FROM changed`);
      expect(provisioned).toBe(String(admin.id));
      expect(sql(`SELECT CASE WHEN senha_hash LIKE '$2%' THEN 'OK' ELSE 'BAD' END FROM agerp.usuario WHERE id_usuario=${admin.id} AND email='${admin.email}'`)).toBe('OK');
      await signup(operator);
      admin1 = await login(admin);
      admin2 = await login(admin);
      expect((await mutate(admin2, 'post', `/api/admin/usuarios/${operator.id}/aprovar`)).status()).toBe(200);
      oper = await login(operator);

      const invalidCtx = await playwright.request.newContext({ baseURL: origin });
      try {
        expect((await invalidCtx.post('/api/auth/login', { data: { email: operator.email, senha: 'invalid' } })).status()).toBe(403);
        expect((await mutate(invalidCtx, 'post', '/api/auth/login', { email: operator.email, senha: randomUUID() })).status()).toBe(401);
      } finally { await invalidCtx.dispose(); }

      expect((await oper.get('/api/admin/logs')).status()).toBe(403);
      expect((await oper.get('/api/admin/relatorios')).status()).toBe(403);
      expect((await admin2.get('/api/admin/logs?page=0&size=5')).status()).toBe(200);
      const restrictedPage = await browser.newContext({ baseURL: origin, storageState: await oper.storageState() });
      try {
        const page = await restrictedPage.newPage();
        await page.goto('/admin');
        await expect(page).not.toHaveURL(/\/admin\/?$/);
        await expect(page.getByRole('heading', { name: 'Painel Administrativo' })).toHaveCount(0);
      } finally { await restrictedPage.close(); }

      const adminSessions = await (await admin1.get('/api/auth/sessions')).json() as Session[];
      expect(adminSessions.filter((s) => s.active)).toHaveLength(2);
      const replayCookies = (await admin1.storageState()).cookies;
      expect((await mutate(admin1, 'post', '/api/auth/logout')).status()).toBe(200);
      expect((await admin1.get('/api/auth/me')).status()).toBe(401);
      const replay = await playwright.request.newContext({ baseURL: origin, storageState: { cookies: replayCookies, origins: [] } });
      try { expect((await replay.get('/api/auth/me')).status()).toBe(401); } finally { await replay.dispose(); }
      expect((await admin2.get('/api/auth/me')).status()).toBe(200);
      const userSessions = await (await admin2.get(`/api/auth/admin/users/${operator.id}/sessions`)).json() as Session[];
      const active = userSessions.find((s) => s.active);
      expect(active).toBeTruthy();
      expect((await mutate(admin2, 'delete', `/api/auth/admin/users/${operator.id}/sessions/${active!.id}`)).status()).toBe(204);
      expect((await oper.get('/api/auth/me')).status()).toBe(401);
      await oper.dispose();
      oper = await login(operator);

      const clientName = `V02 DEPLOY ${suffix}`;
      const clientResponse = await mutate(admin2, 'post', '/api/clientes', {
        nomeRazao: clientName, tipo: 'FISICA', email: `v02-deploy-client-${suffix}@example.invalid`,
      });
      expect(clientResponse.status()).toBe(201);
      resources.cliente = (await clientResponse.json()).id;
      const productResponse = await mutate(admin2, 'post', '/api/produtos', {
        nome: `V02 DEPLOY PRODUTO ${suffix}`, preco: 35.50, custo: 12.25,
        quantidadeInicial: 7, quantidadeMinima: 1, peso: 0.5,
      });
      expect(productResponse.status()).toBe(201);
      resources.produto = (await productResponse.json()).id;
      const orderResponse = await mutate(admin2, 'post', '/api/pedidos', {
        idCliente: resources.cliente, itens: [{ idProduto: resources.produto, quantidade: 2 }],
      });
      expect(orderResponse.status()).toBe(201);
      const order = await orderResponse.json() as { id: number; status: string; valorTotal: number };
      resources.pedido = order.id;
      expect(order.status).toBe('PENDENTE');
      expect(Number(order.valorTotal)).toBe(71);
      const stock = async () => {
        const r = await admin2!.get(`/api/produtos/${resources.produto}`);
        expect(r.status()).toBe(200);
        return (await r.json() as { quantidadeAtual: number }).quantidadeAtual;
      };
      expect(await stock()).toBe(7);
      const forecastResp = await admin2.get(`/api/pedidos/${order.id}/previsao-entrega`, { timeout: 30_000 });
      expect(forecastResp.status()).toBe(200);
      const forecast = await forecastResp.json() as { idPedido: number; status: string; prazoMinimoDias: number; prazoMaximoDias: number };
      expect(forecast.idPedido).toBe(order.id);
      expect(['SUCESSO', 'ESTIMATIVA_HEURISTICA']).toContain(forecast.status);
      expect(forecast.prazoMinimoDias).toBeGreaterThan(0);
      expect(forecast.prazoMaximoDias).toBeGreaterThanOrEqual(forecast.prazoMinimoDias);
      console.log(`V02_DEPLOY_FORECAST=${forecast.status}`);
      const xsrf = await csrf(admin2);
      const confirm = await admin2.patch(`/api/pedidos/${order.id}/status?status=CONFIRMADO`, { headers: { [xsrf.headerName]: xsrf.token } });
      expect(confirm.status()).toBe(200);
      expect((await confirm.json()).status).toBe('CONFIRMADO');
      expect(await stock()).toBe(5);
      const canceled = await mutate(admin2, 'post', `/api/pedidos/${order.id}/cancelar`);
      expect(canceled.status()).toBe(200);
      expect((await canceled.json()).status).toBe('CANCELADO');
      expect(await stock()).toBe(7);
      expect(Number(sql(`SELECT count(*) FROM agerp.movimentacao_estoque WHERE id_produto=${resources.produto} AND tipo IN ('SAIDA','ENTRADA')`))).toBe(2);

      const logsResponse = await admin2.get('/api/admin/logs?page=0&size=100&sortBy=id&direction=desc');
      expect(logsResponse.status()).toBe(200);
      const logs = (await logsResponse.json()).content as Record<string, unknown>[];
      const forResource = (action: string, resource: number) => logs.filter((l) => l.acao === action && String(l.recursoId) === String(resource));
      expect(forResource('CRIACAO_CLIENTE', resources.cliente)).toHaveLength(1);
      expect(forResource('CRIACAO_PRODUTO', resources.produto)).toHaveLength(1);
      expect(forResource('CRIACAO_PEDIDO', resources.pedido)).toHaveLength(1);
      expect(forResource('ALTERACAO_STATUS_PEDIDO', resources.pedido)).toHaveLength(2);
      const forecastAction = forecast.status === 'SUCESSO' ? 'CALCULO_PREVISAO_IA' : 'FALLBACK_PREVISAO_IA';
      expect(forResource(forecastAction, resources.pedido)).toHaveLength(1);
      expect(logs.every((l) => !JSON.stringify(l).toLowerCase().includes('senhahash'))).toBe(true);
      const stockLogs = await admin2.get(`/api/admin/logs?entidade=ESTOQUE&recursoId=${resources.produto}&size=50`);
      expect(stockLogs.status()).toBe(200);
      for (const action of ['BAIXA_ESTOQUE_PEDIDO', 'ESTORNO_ESTOQUE_PEDIDO']) {
        expect(((await stockLogs.json()).content as { acao: string }[]).filter((l) => l.acao === action)).toHaveLength(1);
      }

      expect((await oper.get('/api/admin/relatorios/clientes_cadastro/xlsx')).status()).toBe(403);
      const catalogResponse = await admin2.get('/api/admin/relatorios');
      expect(catalogResponse.status()).toBe(200);
      expect((await catalogResponse.json()).length).toBe(39);
      async function workbook(path: string, expectClient: boolean) {
        const resp = await admin2!.get(path, { timeout: 30_000 });
        expect(resp.status()).toBe(200);
        expect(resp.headers()['content-type']).toContain('spreadsheetml.sheet');
        const payload = await resp.body();
        const zip = verifyZipWithNode(payload);
        expect(zip.entries).toBeGreaterThan(0);
        const book = XLSX.read(payload, { type: 'buffer' });
        expect(book.SheetNames.length).toBeGreaterThan(0);
        const rows = book.SheetNames.flatMap((sheet) => XLSX.utils.sheet_to_json(book.Sheets[sheet], { header: 1 }) as unknown[][]);
        expect(rows.length).toBeGreaterThan(0);
        const included = rows.some((row) => row.some((cell) => String(cell) === clientName));
        expect(included).toBe(expectClient);
        console.log(`V02_DEPLOY_XLSX sheets=${book.SheetNames.length} rows=${rows.length} filterClient=${expectClient} zipEntries=${zip.entries} dataDescriptors=${zip.dataDescriptors}`);
      }
      await workbook(`/api/admin/relatorios/clientes_cadastro/xlsx?clienteId=${resources.cliente}`, true);
      await workbook('/api/admin/relatorios/clientes_cadastro/xlsx?clienteId=999999999', false);
      await workbook('/api/admin/relatorios/clientes_cadastro/xlsx', true);
      const exportResp = await admin2.get('/api/admin/relatorios/auditoria_exportacoes/xlsx');
      expect(exportResp.status()).toBe(200);
      const exportId = exportResp.headers()['x-export-id'];
      expect(exportId).toMatch(/^[0-9a-f-]{36}$/i);
      const auditPayload = await exportResp.body();
      const auditZip = verifyZipWithNode(auditPayload);
      const auditBook = XLSX.read(auditPayload, { type: 'buffer' });
      const auditRows = auditBook.SheetNames.flatMap((sheet) => XLSX.utils.sheet_to_json(auditBook.Sheets[sheet], { header: 1 }) as unknown[][]);
      expect(auditRows.length).toBeGreaterThan(1);
      expect(JSON.stringify(auditRows)).not.toContain(exportId);
      await expect.poll(() => Number(sql(`SELECT count(*) FROM agerp.log_sistema WHERE entidade='RELATORIO' AND recurso_id='${exportId}' AND acao IN ('EXPORTACAO_SOLICITADA','EXPORTACAO_GERADA')`))).toBe(2);
      console.log(`V02_DEPLOY_ZIP_INDEPENDENT entries=${auditZip.entries} dataDescriptors=${auditZip.dataDescriptors} crc=PASS`);

      // Interrompe uma conexão TCP/HTTP autenticada após os primeiros bytes XLSX passarem
      // pelo Nginx implantado. Isso testa o aborto real do socket, embora uma resposta
      // pequena já possa ter sido escrita no upstream.
      const tempFiles = () => docker('exec', 'agerp-app', 'sh', '-c',
        'find /tmp/agerp-xlsx-spool -mindepth 2 -maxdepth 2 -type f -name "*.xlsx" -print');
      const beforeTemps = tempFiles();
      const cookieHeader = (await admin2.storageState()).cookies
        .map(item => `${item.name}=${item.value}`).join('; ');
      const disconnected = await new Promise<{ id: string; firstChunk: number }>((resolve, reject) => {
        const req = httpRequest(`${origin}/api/admin/relatorios/auditoria_logs/xlsx`, {
          headers: { Cookie: cookieHeader, Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
        }, response => {
          const id = response.headers['x-export-id'];
          if (response.statusCode !== 200 || typeof id !== 'string') {
            response.resume();
            reject(new Error(`Socket test HTTP ${response.statusCode ?? 0}`));
            return;
          }
          response.once('data', (chunk: Buffer) => {
            response.destroy();
            resolve({ id, firstChunk: chunk.length });
          });
          response.once('end', () => reject(new Error('Socket test ended before first bytes')));
          response.on('error', () => {}); // O aborto é esperado após destroy().
        });
        req.setTimeout(15_000, () => req.destroy(new Error('Socket test timeout')));
        req.on('error', reject);
        req.end();
      });
      expect(disconnected.firstChunk).toBeGreaterThan(0);
      await expect.poll(() => Number(sql(`SELECT count(*) FROM agerp.log_sistema WHERE entidade='RELATORIO' AND recurso_id='${disconnected.id}' AND acao='EXPORTACAO_GERADA'`)),
        { timeout: 12_000 }).toBe(1);
      await expect.poll(() => Number(sql(`SELECT count(*) FROM agerp.log_sistema WHERE entidade='RELATORIO' AND recurso_id='${disconnected.id}' AND acao IN ('EXPORTACAO_TRANSMISSAO_ENCERRADA','EXPORTACAO_FALHA')`)),
        { timeout: 12_000 }).toBe(1);
      await expect.poll(tempFiles, { timeout: 12_000 }).toBe(beforeTemps);
      const terminal = sql(`SELECT acao FROM agerp.log_sistema WHERE entidade='RELATORIO' AND recurso_id='${disconnected.id}' AND acao IN ('EXPORTACAO_TRANSMISSAO_ENCERRADA','EXPORTACAO_FALHA')`);
      console.log(`V02_DEPLOY_SOCKET firstChunk=${disconnected.firstChunk}B clientAbort=YES serverTerminal=${terminal} tempRestored=YES`);

      // Validação real de navegador e interface pelo Nginx implantado, sem mocks de resposta.
      const adminBrowser = await browser.newContext({ baseURL: origin, storageState: await admin2.storageState() });
      try {
        const page = await adminBrowser.newPage();
        for (const width of [390, 1280]) {
          await page.setViewportSize({ width, height: 844 });
          await page.goto('/admin');
          await expect(page.getByRole('heading', { name: 'Painel Administrativo' })).toBeVisible();
          await page.getByRole('button', { name: /Logs do Sistema/ }).click();
          await expect(page.getByRole('heading', { name: 'Auditoria do Sistema' })).toBeVisible();
          const inspect = page.getByRole('button', { name: width < 768 ? 'Ver detalhes' : 'Ver', exact: true }).first();
          await inspect.focus();
          await page.keyboard.press('Enter');
          const dialog = page.getByRole('dialog', { name: 'Detalhes do evento' });
          await expect(dialog).toBeVisible();
          await expect(page.getByRole('button', { name: 'Fechar detalhes' })).toBeFocused();
          await page.keyboard.press('Escape');
          await expect(dialog).toHaveCount(0);
          await expect(inspect).toBeFocused();
          expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
          const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
          expect(axe.violations.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) })),
            `WCAG 2 A/AA via deployed Nginx @${width}px`).toEqual([]);
        }
        await page.getByRole('button', { name: /Relatórios/ }).click();
        await expect(page.getByRole('heading', { name: 'Central de relatórios' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Exportar XLSX' })).toBeEnabled();
        // No Firefox, dois cliques separados concorrem com respostas XLSX muito pequenas.
        // Os eventos são disparados na mesma tarefa do navegador para preservar o fluxo HTTP
        // sem permitir que o download remova o botão entre os comandos.
        await page.evaluate(async () => {
          const button = (label: string) => Array.from(document.querySelectorAll('button'))
            .find(element => element.textContent?.trim() === label);
          const start = button('Exportar XLSX');
          if (!start) throw new Error('Export XLSX control missing');
          (start as HTMLButtonElement).click();
          await Promise.resolve(); // O render do evento discreto do React expõe o controle de cancelamento.
          const cancel = button('Cancelar download');
          if (!cancel) throw new Error('Cancel control missing while export is pending');
          (cancel as HTMLButtonElement).click();
        });
        await expect(page.getByRole('alert')).toContainText('Download cancelado neste navegador');
        await expect(page.getByRole('button', { name: 'Exportar XLSX' })).toBeEnabled();
        console.log('V02_DEPLOY_UI modalKeyboardFocus=PASS axe390_1280=PASS frontendAbort=PASS');
      } finally { await adminBrowser.close(); }

      // Carga autenticada, limitada e somente leitura na imagem final após aquecimento.
      // É uma observação operacional, não uma afirmação de escalabilidade em produção.
      if (process.env.E2E_DEPLOY_LOAD === 'I_AUTHORIZE_BOUNDED_LOAD'
          && browser.browserType().name() === 'chromium') {
        const endpoint = '/api/admin/logs?page=0&size=5';
        for (let i = 0; i < 25; i++) expect((await admin2.get(endpoint)).status()).toBe(200);
        const latencies: number[] = [];
        const counts = new Map<number, number>();
        const deadline = Date.now() + 15_000;
        const started = Date.now();
        const samples: string[] = [];
        const sample = () => {
          try { samples.push(docker('stats', '--no-stream', '--format', '{{.Name}}|{{.MemUsage}}|{{.CPUPerc}}',
            'agerp-app', 'agerp-postgres', 'agerp-frontend', 'agerp-python')); }
          catch (err) { samples.push(`stats unavailable: ${String(err)}`); }
        };
        sample();
        await Promise.all(Array.from({ length: 5 }, async () => {
          while (Date.now() < deadline) {
            const start = performance.now();
            try {
              const response = await admin2!.get(endpoint, { timeout: 15_000 });
              counts.set(response.status(), (counts.get(response.status()) ?? 0) + 1);
            } catch { counts.set(0, (counts.get(0) ?? 0) + 1); }
            latencies.push(performance.now() - start);
          }
        }));
        sample();
        const sorted = latencies.toSorted((a, b) => a - b);
        const percentile = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))].toFixed(1);
        console.log(`V02_DEPLOY_LOAD durationMs=${Date.now() - started} count=${sorted.length} `
          + `status=${JSON.stringify(Object.fromEntries(counts))} p50Ms=${percentile(0.5)} p95Ms=${percentile(0.95)} p99Ms=${percentile(0.99)}`);
        console.log(`V02_DEPLOY_RESOURCE_SAMPLES ${JSON.stringify(samples)}`);
        expect(sorted.length).toBeGreaterThan(50);
        expect([...counts.entries()].filter(([status]) => status !== 200)).toEqual([]);
      }
      console.log(`V02_DEPLOY_RESOURCES users=${admin.id},${operator.id} client=${resources.cliente} product=${resources.produto} order=${resources.pedido}`);
    } finally {
      // A limpeza só pode atingir os dois usuários sintéticos criados pelo teste.
      try {
        if (operator.id && admin2) {
          const sessionsResponse = await admin2.get(`/api/auth/admin/users/${operator.id}/sessions`);
          if (sessionsResponse.status() === 200) {
            for (const s of (await sessionsResponse.json() as Session[]).filter((item) => item.active)) {
              const response = await mutate(admin2, 'delete', `/api/auth/admin/users/${operator.id}/sessions/${s.id}`);
              if (response.status() !== 204) cleanupErrors.push('Unable to revoke synthetic operator session');
            }
          }
          if (sql(`SELECT status_acesso FROM agerp.usuario WHERE id_usuario=${operator.id} AND email='${operator.email}'`) === 'APROVADO') {
            const response = await mutate(admin2, 'post', `/api/admin/usuarios/${operator.id}/bloquear`);
            if (response.status() !== 200) cleanupErrors.push('Unable to block synthetic operator using API');
          }
        }
      } catch (err) { cleanupErrors.push(`Operator: ${String(err)}`); }
      for (const ctx of [admin1, admin2]) {
        if (!ctx) continue;
        try {
          if ((await ctx.get('/api/auth/me')).status() === 200) {
            const response = await mutate(ctx, 'post', '/api/auth/logout');
            if (response.status() !== 200) cleanupErrors.push('Synthetic admin logout failed');
          }
        } catch (err) { cleanupErrors.push(`Logout: ${String(err)}`); }
      }
      try {
        if (operator.id) deactivateOwnUser(operator);
        if (admin.id) deactivateOwnUser(admin);
        const ids = [admin.id, operator.id].filter((v): v is number => Number.isInteger(v));
        if (ids.length) {
          // O fallback de sessão se restringe aos IDs registrados e verificados por este teste.
          const result = sql(`WITH updated AS (UPDATE agerp.sessao_autenticacao SET revogada_em=now(),motivo_revogacao='FIM_TESTE_V02' WHERE id_usuario IN (${ids.join(',')}) AND revogada_em IS NULL RETURNING id) SELECT count(*) FROM updated`);
          console.log(`V02_DEPLOY_CLEANUP sessionFallback=${result} accountsDisabled=${ids.length}`);
          const remaining = sql(`SELECT count(*) FROM agerp.usuario WHERE id_usuario IN (${ids.join(',')}) AND ativo=true`);
          if (remaining !== '0') cleanupErrors.push('Synthetic accounts remain active');
        }
      } catch (err) { cleanupErrors.push(`Restricted DB cleanup: ${String(err)}`); }
      await Promise.allSettled([registration, admin1, admin2, oper].filter((c): c is APIRequestContext => Boolean(c)).map((c) => c.dispose()));
      if (cleanupErrors.length) cleanupError = new Error(`Synthetic cleanup incomplete: ${cleanupErrors.join(' | ')}`);
    }
    if (cleanupError) throw cleanupError;
  });
});
