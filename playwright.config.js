import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser', workers: 1, timeout: 60_000,
  use: { baseURL: 'http://localhost:3100', browserName: 'chromium', channel: process.env.PLAYWRIGHT_CHANNEL || undefined, screenshot: 'only-on-failure' },
  webServer: { command: 'node server/index.js', url: 'http://localhost:3100/api/health', reuseExistingServer: false, env: { PORT: '3100', DATABASE_PATH: ':memory:', APP_ORIGIN: 'http://localhost:3100' } },
});
