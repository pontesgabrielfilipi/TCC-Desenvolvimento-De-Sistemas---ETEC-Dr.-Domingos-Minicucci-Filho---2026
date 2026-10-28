// Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
// Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.

import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { request as httpRequest } from 'node:http';

// Opt-in explícito para uma carga sintética, temporária e limitada no agdb DE TESTE.
const origin = 'http://127.0.0.1:5173';
const allowed = process.env.E2E_TEST_DEPLOY_AUTH === 'I_AUTHORIZE_TEST_ACCOUNTS'
  && process.env.E2E_BASE_URL === origin && process.env.E2E_LONG_STREAM === 'I_AUTHORIZE_SYNTHETIC_LOGS';
const project = 'tcc-desenvolvimento-de-sistemas---etec-dr-domingos-minicucci-filho---2026';
const imageIds = {
  'agerp-app': 'sha256:8b298958a1f5a088f5c782253e53cab0cf7c1ee854c18a446418242e2c82d418',
  'agerp-frontend': 'sha256:0762bc7a153edee23deb5dc656524caba47a37321a177e1ddabbcf733cb07606',
  'agerp-python': 'sha256:e6ddcc88671d1d193660fa8e5f10e7f7a145c39fc1f19ad674a63f7dc5477d46',
};
const rows = 60_000;

function docker(...args: string[]) {
  return execFileSync('docker', args, { encoding: 'utf8', timeout: 30_000, windowsHide: true }).trim();
}
function sql(query: string) {
  return docker('exec', 'agerp-postgres', 'psql', '-X', '-U', 'admin', '-d', 'agdb', '-v', 'ON_ERROR_STOP=1', '-Atc', query);
}
function guard() {
  const expected = ['agerp-postgres', 'agerp-app', 'agerp-frontend', 'agerp-python'];
  const services = ['postgres', 'backend-api', 'frontend', 'python-ia-api'];
  const found = JSON.parse(docker('inspect', ...expected)) as Array<{
    Name: string; Image: string; Config: { Labels: Record<string, string>; Env: string[] };
    State: { Running: boolean }; Mounts: Array<{ Name?: string }>;
    NetworkSettings: { Ports: Record<string, Array<{ HostIp: string; HostPort: string }> | null> };
  }>;
  found.forEach((c, i) => {
    if (c.Name !== '/' + expected[i] || !c.State.Running
      || c.Config.Labels['com.docker.compose.project'] !== project
      || c.Config.Labels['com.docker.compose.service'] !== services[i]) throw new Error('Unexpected TEST Compose target');
    const id = imageIds[expected[i] as keyof typeof imageIds];
    if (id && c.Image !== id) throw new Error('Unexpected TEST image');
  });
  if (!found[0].Mounts.some(v => v.Name === `${project}_pgdata`)
    || !found[1].Config.Env.includes('SPRING_DATASOURCE_URL=jdbc:postgresql://postgres:5432/agdb')) {
    throw new Error('Unexpected database target');
  }
  const port = found[2].NetworkSettings.Ports['80/tcp'];
  if (port?.length !== 1 || port[0].HostIp !== '127.0.0.1' || port[0].HostPort !== '5173') {
    throw new Error('Unexpected Nginx port');
  }
  if (sql("SELECT current_database() || ':' || current_setting('server_version_num')::int/10000") !== 'agdb:16') {
    throw new Error('Unexpected DB identity');
  }
}

type Transfer = { id: string; status: number; received: number; firstBytes: number; durationMs: number; complete: boolean; error: string | null };
function transfer(cookie: string, mode: 'slow' | 'abort' | 'stall'): Promise<Transfer> {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    let received = 0;
    let firstBytes = 0;
    let done = false;
    let held = false;
    let finished = false;
    const req = httpRequest(`${origin}/api/admin/relatorios/auditoria_logs/xlsx`, {
      headers: { Cookie: cookie, Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
    }, response => {
      const id = response.headers['x-export-id'];
      if (response.statusCode !== 200 || typeof id !== 'string') {
        response.resume();
        reject(new Error(`Unexpected response ${response.statusCode}`));
        return;
      }
      const finish = (complete: boolean, error: string | null) => {
        if (finished) return;
        finished = true;
        resolve({ id, status: response.statusCode!, received, firstBytes, durationMs: Date.now() - started, complete, error });
      };
      response.on('data', (chunk: Buffer) => {
        received += chunk.length;
        if (!firstBytes) firstBytes = chunk.length;
        if (mode === 'abort' && received >= 512 * 1024) {
          response.destroy();
          finish(false, 'CLIENT_ABORT');
        } else if (mode === 'slow' && !done) {
          response.pause();
          setTimeout(() => { if (!finished) response.resume(); }, 90);
        } else if (mode === 'stall' && !held) {
          held = true;
          response.pause();
          setTimeout(() => { if (!finished) response.resume(); }, 75_000);
        }
      });
      response.once('end', () => { done = true; finish(true, null); });
      response.once('aborted', () => finish(false, 'ABORTED_BY_PEER'));
      response.once('error', error => finish(false, error.message));
      response.once('close', () => { if (!finished) finish(false, 'CLOSED_BEFORE_END'); });
    });
    req.setTimeout(140_000, () => req.destroy(new Error('CLIENT_TEST_TIMEOUT')));
    req.once('error', reject);
    req.end();
  });
}

test.describe('V02 Nginx prolonged transfer (synthetic TEST data only)', () => {
  test.skip(!allowed, 'Explicit synthetic TEST opt-in is required');
  test('slow completion, midstream abort, idle reader and scoped cleanup', async ({ playwright }) => {
    test.setTimeout(240_000);
    guard();
    const key = randomUUID().replaceAll('-', '').slice(0, 16);
    const label = `agerp-long-${key}`;
    const email = `v02-deploy-long-${key}@example.invalid`;
    const password = randomBytes(36).toString('base64url');
    let userId: number | undefined;
    let inserted = false;
    const registry = await playwright.request.newContext({ baseURL: origin });
    const auth = await playwright.request.newContext({ baseURL: origin });
    const baseline = () => docker('exec', 'agerp-app', 'sh', '-c', 'find /tmp/agerp-xlsx-spool -mindepth 2 -maxdepth 2 -type f -name "*.xlsx" -print');
    const tempsBefore = baseline();
    const statusBefore = docker('stats', '--no-stream', '--format', '{{.Name}} {{.MemUsage}}');
    try {
      const csrf = async (context: typeof registry) => (await (await context.get('/api/auth/csrf')).json()) as { token: string; headerName: string };
      let token = await csrf(registry);
      const registered = await registry.post('/api/usuarios', {
        headers: { [token.headerName]: token.token },
        data: { nome: `V02 LONG ${key}`, email, senha: password, idPerfil: 2 },
      });
      expect(registered.status()).toBe(201);
      userId = (await registered.json() as { id: number }).id;
      expect(sql(`WITH approved AS (UPDATE agerp.usuario SET ativo=true,status_acesso='APROVADO',id_perfil=(SELECT id_perfil FROM agerp.perfil WHERE nome='ADMIN') WHERE id_usuario=${userId} AND email='${email}' AND status_acesso='PENDENTE' AND ativo=false RETURNING id_usuario) SELECT id_usuario FROM approved`)).toBe(String(userId));
      token = await csrf(auth);
      expect((await auth.post('/api/auth/login', { headers: { [token.headerName]: token.token }, data: { email, senha: password } })).status()).toBe(200);

      // Os campos variam de forma determinística para impedir compressão em uma resposta irrealmente pequena.
      // Um INSERT usa marcador único de proprietário, e o finally remove apenas essas linhas.
      const insertedRows = sql(`WITH ins AS (INSERT INTO agerp.log_sistema
        (acao,entidade,recurso_id,resultado,detalhes,usuario_nome,usuario_email,usuario_perfil,ip,
         correlation_id,session_ref,device_ref,peer_ip,user_agent,http_method,http_route,http_status,duration_ms)
        SELECT 'SYNTHETIC_STREAM','TEST_PROBE','${label}','TEST', md5(g::text || '-details'),
        md5(g::text || '-user'), md5(g::text || '-email'), 'ADMIN',
        md5(g::text || '-ip'), md5(g::text || '-corr'), md5(g::text || '-sess'),
        md5(g::text || '-device'), md5(g::text || '-peer'),md5(g::text || '-agent'),
        'GET','/synthetic/' || md5(g::text || '-route'),200,g
        FROM generate_series(1, ${rows}) g RETURNING id_log)
        SELECT count(*) FROM ins`);
      inserted = true;
      expect(Number(insertedRows)).toBe(rows);
      const cookie = (await auth.storageState()).cookies.map(c => `${c.name}=${c.value}`).join('; ');

      for (const mode of ['slow', 'abort', 'stall'] as const) {
        const result = await transfer(cookie, mode);
        if (mode === 'slow') {
          expect(result.complete, 'A slow client must receive the full transfer').toBe(true);
          expect(result.durationMs).toBeGreaterThan(3_000);
          expect(result.received).toBeGreaterThan(1024 * 1024);
        }
        if (mode === 'abort') {
          expect(result.complete).toBe(false);
          expect(result.received).toBeGreaterThanOrEqual(512 * 1024);
        }
        await expect.poll(() => Number(sql(`SELECT count(*) FROM agerp.log_sistema WHERE recurso_id='${result.id}' AND acao IN ('EXPORTACAO_TRANSMISSAO_ENCERRADA','EXPORTACAO_FALHA')`)), { timeout: 30_000 }).toBe(1);
        await expect.poll(baseline, { timeout: 30_000 }).toBe(tempsBefore);
        const terminal = sql(`SELECT acao || ':' || COALESCE(resultado,'') FROM agerp.log_sistema WHERE recurso_id='${result.id}' AND acao IN ('EXPORTACAO_TRANSMISSAO_ENCERRADA','EXPORTACAO_FALHA')`);
        console.log(`LONG_STREAM mode=${mode} durationMs=${result.durationMs} bytes=${result.received} complete=${result.complete} error=${result.error} audit=${terminal}`);
      }
      console.log(`LONG_STREAM_RESOURCES before=${JSON.stringify(statusBefore)} after=${JSON.stringify(docker('stats','--no-stream','--format','{{.Name}} {{.MemUsage}}'))}`);
    } finally {
      try { if (inserted) console.log(`LONG_STREAM_CLEANED rows=${sql(`WITH deleted AS (DELETE FROM agerp.log_sistema WHERE recurso_id='${label}' AND entidade='TEST_PROBE' AND acao='SYNTHETIC_STREAM' RETURNING id_log) SELECT count(*) FROM deleted`)}`); }
      finally {
        try { if (userId !== undefined) {
          sql(`UPDATE agerp.usuario SET ativo=false,status_acesso='BLOQUEADO',credential_version=COALESCE(credential_version,0)+1 WHERE id_usuario=${userId} AND email='${email}'`);
        } } finally { await auth.dispose(); await registry.dispose(); }
      }
    }
  });
});
