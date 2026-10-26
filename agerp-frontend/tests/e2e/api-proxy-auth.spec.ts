import { expect, test } from '@playwright/test';

test('login usa /api na mesma origem e conserva cookie HttpOnly', async ({ page }) => {
  let loginOrigin = '';
  let cookieRecebidoNoMe = false;
  let csrfObtido = false;
  await page.route('**/api/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (!path.startsWith('/api/')) return route.continue();
    if (path === '/api/auth/csrf') {
      csrfObtido = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'set-cookie': 'XSRF-TOKEN=token-csrf-de-teste; SameSite=Strict; Path=/' },
        body: JSON.stringify({ token: 'token-csrf-de-teste' }),
      });
    } else if (path === '/api/auth/login') {
      expect(csrfObtido).toBe(true);
      expect(request.headers()['x-xsrf-token']).toBe('token-csrf-de-teste');
      loginOrigin = new URL(request.url()).origin;
      expect(request.method()).toBe('POST');
      expect(request.postDataJSON()).toEqual({ email: 'teste@agerp.local', senha: 'teste-seguro' });
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'set-cookie': 'jwtToken=token-de-teste; HttpOnly; SameSite=Strict; Path=/' },
        body: JSON.stringify({ message: 'Login realizado com sucesso', trocaSenhaObrigatoria: false }),
      });
    } else if (path === '/api/auth/me') {
      cookieRecebidoNoMe = (request.headers().cookie ?? '').includes('jwtToken=token-de-teste');
      await route.fulfill({
        status: cookieRecebidoNoMe ? 200 : 401,
        contentType: 'application/json',
        body: cookieRecebidoNoMe
          ? JSON.stringify({
              id: 1,
              nome: 'Teste',
              email: 'teste@agerp.local',
              perfilNome: 'OPERADOR',
              ativo: true,
              statusAcesso: 'APROVADO',
              paginas: ['DASHBOARD'],
              nivelAutoridade: 10,
            })
          : '{}',
      });
    } else {
      await route.fulfill({ status: 401, body: '{}' });
    }
  });

  await page.goto('/login');
  await page.locator('input[type="email"]').fill('teste@agerp.local');
  await page.locator('input[type="password"]').fill('teste-seguro');
  await page.locator('button[type="submit"]').click();

  await expect(page).toHaveURL(/\/dashboard$/);
  expect(loginOrigin).toBe(new URL(page.url()).origin);
  expect(cookieRecebidoNoMe).toBe(true);
  expect(csrfObtido).toBe(true);
  const cookie = (await page.context().cookies()).find(item => item.name === 'jwtToken');
  expect(cookie?.httpOnly).toBe(true);
  expect(cookie?.sameSite).toBe('Strict');
});

test('credenciais invalidas permanecem na origem da pagina', async ({ page }) => {
  let loginOrigin = '';
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    if (!url.pathname.startsWith('/api/')) return route.continue();
    if (url.pathname === '/api/auth/csrf') {
      await route.fulfill({ status: 200, contentType: 'application/json',
        headers: { 'set-cookie': 'XSRF-TOKEN=token-csrf-de-teste; SameSite=Strict; Path=/' },
        body: JSON.stringify({ token: 'token-csrf-de-teste' }) });
    } else if (url.pathname === '/api/auth/login') {
      expect(route.request().headers()['x-xsrf-token']).toBe('token-csrf-de-teste');
      loginOrigin = url.origin;
      await route.fulfill({ status: 401, contentType: 'application/json', body: '{"message":"Email ou senha inválidos"}' });
    } else {
      await route.fulfill({ status: 401, body: '{}' });
    }
  });

  await page.goto('/login');
  await page.locator('input[type="email"]').fill('invalido@agerp.local');
  await page.locator('input[type="password"]').fill('senha-invalida');
  await page.locator('button[type="submit"]').click();

  await expect(page.getByText('Email ou senha inválidos. Tente novamente.')).toBeVisible();
  expect(loginOrigin).toBe(new URL(page.url()).origin);
  await expect(page).toHaveURL(/\/login$/);
});
