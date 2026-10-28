// Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
// Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.

import { expect, test } from '@playwright/test';

// O opt-in explícito impede que o teste atinja o mock normal do Vite ou outra aplicação em execução.
const isolatedBaseURL = process.env.E2E_ISOLATED_BASE_URL;

test.describe('V02 - CSRF through the isolated real Nginx', () => {
  test.skip(!isolatedBaseURL, 'Requires E2E_ISOLATED_BASE_URL pointing to an isolated test stack');

  test('bootstrap is public; login still requires CSRF and valid credentials', async ({ playwright }) => {
    const client = await playwright.request.newContext({ baseURL: isolatedBaseURL });

    try {
      const bootstrap = await client.get('/api/auth/csrf');
      expect(bootstrap.status()).toBe(200);

      const tokenResponse: { headerName: string; token: string } = await bootstrap.json();
      expect(tokenResponse.headerName).toBe('X-XSRF-TOKEN');
      expect(tokenResponse.token.length).toBeGreaterThan(0);

      const cookies = (await client.storageState()).cookies;
      expect(cookies.some(cookie => cookie.name === 'XSRF-TOKEN')).toBe(true);

      const invalidCredentials = {
        email: 'invalido-v02@example.invalid',
        password: 'senha-invalida-v02',
      };

      const missingCsrf = await client.post('/api/auth/login', { data: invalidCredentials });
      expect(missingCsrf.status()).toBe(403);

      const validCsrf = await client.post('/api/auth/login', {
        data: invalidCredentials,
        headers: { [tokenResponse.headerName]: tokenResponse.token },
      });
      expect(validCsrf.status()).toBe(401);
    } finally {
      await client.dispose();
    }
  });
});
