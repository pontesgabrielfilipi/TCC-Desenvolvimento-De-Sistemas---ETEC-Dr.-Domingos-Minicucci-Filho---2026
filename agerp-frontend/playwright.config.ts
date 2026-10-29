// Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
// Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.

import { defineConfig, devices } from '@playwright/test';

const origin = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5189';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : 3,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: origin,
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    actionTimeout: 10_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: process.env.E2E_BASE_URL ? undefined : {
    command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5189 --strictPort',
    url: origin,
    reuseExistingServer: false,
    timeout: 90_000,
  },
});
