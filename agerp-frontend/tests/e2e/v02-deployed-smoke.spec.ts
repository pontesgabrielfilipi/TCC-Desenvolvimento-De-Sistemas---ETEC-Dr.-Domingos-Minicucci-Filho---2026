import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

// Testes opt-in exclusivos para o Compose LOCAL DE TESTE já existente.
// Não criam usuários, não carregam seeds, não fazem escritas destrutivas nem usam credenciais.
const target = 'http://127.0.0.1:5173';
const enabled = process.env.E2E_TEST_DEPLOY_URL === target
  && process.env.E2E_BASE_URL === target;

test.use({ trace: 'off', screenshot: 'off', video: 'off' });

function assertTestTarget(): void {
  const containers = JSON.parse(execFileSync('docker', [
    'inspect', 'agerp-postgres', 'agerp-app', 'agerp-python', 'agerp-frontend',
  ], { encoding: 'utf8', timeout: 15_000, windowsHide: true })) as Array<{
    Name: string;
    Config: { Labels: Record<string, string> };
    State: { Running: boolean };
    Mounts: Array<{ Name?: string }>;
    NetworkSettings: { Ports: Record<string, Array<{ HostIp: string; HostPort: string }> | null> };
  }>;
  const expectedProject = 'tcc-desenvolvimento-de-sistemas---etec-dr-domingos-minicucci-filho---2026';
  const expectedServices = ['postgres', 'backend-api', 'python-ia-api', 'frontend'];
  for (let i = 0; i < containers.length; i++) {
    const c = containers[i];
    if (c.Config.Labels['com.docker.compose.project'] !== expectedProject
        || c.Config.Labels['com.docker.compose.service'] !== expectedServices[i]
        || !c.State.Running) throw new Error('Unexpected Compose target or stopped service');
  }
  if (!containers[0].Mounts.some(m => m.Name === `${expectedProject}_pgdata`)) {
    throw new Error('Unexpected PostgreSQL volume');
  }
  const published = containers[3].NetworkSettings.Ports['80/tcp'];
  if (published?.length !== 1 || published[0].HostIp !== '127.0.0.1'
      || published[0].HostPort !== '5173') throw new Error('Unexpected frontend publication');
}

test.describe('V02 - deployed TEST Compose over actual Nginx (no API mocks)', () => {
  test.skip(!enabled, 'Requires explicit opt-in to the verified local test deployment');

  test.beforeAll(() => assertTestTarget());

  test('serves the SPA and denies unauthenticated application access', async ({ page, request }) => {
    const response = await page.goto('/login');
    expect(response?.status()).toBe(200);

    const me = await request.get('/api/auth/me');
    expect(me.status()).toBe(401);
    const sessions = await request.get('/api/auth/sessions');
    expect([401, 403]).toContain(sessions.status());
    const audit = await request.get('/api/admin/logs');
    expect([401, 403]).toContain(audit.status());
  });

  test('requires CSRF for login, rejects invalid credentials with valid CSRF', async ({ playwright }) => {
    const client = await playwright.request.newContext({ baseURL: target });
    try {
      const csrf = await client.get('/api/auth/csrf');
      expect(csrf.status()).toBe(200);
      const token: { headerName: string; token: string } = await csrf.json();
      expect(token.headerName).toBe('X-XSRF-TOKEN');
      expect(token.token.length).toBeGreaterThan(0);
      const cookie = (await client.storageState()).cookies.find(c => c.name === 'XSRF-TOKEN');
      expect(cookie).toBeDefined();
      expect(cookie?.secure, 'loopback HTTP testing must match JWT_COOKIE_SECURE=false').toBe(false);

      const invalid = { email: `not-registered-${randomUUID()}@example.invalid`, senha: randomUUID() };
      expect((await client.post('/api/auth/login', { data: invalid })).status()).toBe(403);
      expect((await client.post('/api/auth/login', {
        data: invalid, headers: { [token.headerName]: token.token },
      })).status()).toBe(401);
    } finally {
      await client.dispose();
    }
  });

  test('allows only identified test origins and rejects forged external origin', async ({ request }) => {
    for (const origin of [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'https://noname.tailf69801.ts.net',
    ]) {
      const response = await request.fetch('/api/auth/login', {
        method: 'OPTIONS',
        headers: {
          Origin: origin,
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'X-XSRF-TOKEN,Content-Type',
        },
      });
      expect(response.status()).toBe(200);
      expect(response.headers()['access-control-allow-origin']).toBe(origin);
      expect(response.headers()['access-control-allow-credentials']).toBe('true');
    }

    for (const origin of ['http://localhost:3000', 'https://untrusted.example.invalid']) {
      const response = await request.fetch('/api/auth/login', {
        method: 'OPTIONS',
        headers: { Origin: origin, 'Access-Control-Request-Method': 'POST' },
      });
      expect(response.headers()['access-control-allow-origin']).toBeUndefined();
      expect(response.status()).not.toBe(200);
    }
  });

  test('cannot gain a privileged session with forged forwarding headers', async ({ request }) => {
    const response = await request.get('/api/auth/sessions', {
      headers: {
        'X-Forwarded-For': '203.0.113.55',
        'X-Forwarded-Proto': 'https',
        'X-Real-IP': '203.0.113.55',
        Forwarded: 'for=203.0.113.55;proto=https',
      },
    });
    expect([401, 403]).toContain(response.status());
  });
});
