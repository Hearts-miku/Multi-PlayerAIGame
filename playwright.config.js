import { defineConfig } from '@playwright/test';
const live = process.env.LIVE_BASE_URL;
export default defineConfig({
  testDir: './tests/browser', workers: 1, timeout: live ? 180_000 : 60_000,
  expect: { timeout: live ? 30_000 : 5_000 },
  use: { baseURL: live || 'http://localhost:3100', browserName: 'chromium', channel: process.env.PLAYWRIGHT_CHANNEL || undefined, screenshot: 'only-on-failure' },
  webServer: live ? undefined : { command: 'node server/index.js', url: 'http://localhost:3100/api/health', reuseExistingServer: false, env: { PORT: '3100', DATABASE_PATH: ':memory:', APP_ORIGIN: 'http://localhost:3100' } },
});
