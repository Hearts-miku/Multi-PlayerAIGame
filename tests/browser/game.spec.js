import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';

test('two browser players register, play, reconnect, rematch, and log out', async ({ browser }, info) => {
  const protectedHeaders = process.env.VERCEL_AUTOMATION_BYPASS_SECRET ? { 'x-vercel-protection-bypass': process.env.VERCEL_AUTOMATION_BYPASS_SECRET } : {};
  const first = await browser.newContext({ viewport: { width: 1440, height: 1050 }, extraHTTPHeaders: protectedHeaders });
  const second = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, extraHTTPHeaders: protectedHeaders });
  if (process.env.VERCEL_AUTOMATION_BYPASS_SECRET) for (const context of [first, second]) {
    const origin = new URL(process.env.LIVE_BASE_URL).origin;
    await context.route('**/*', (route) => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    // WebSocket handshakes use cookies; browser extra HTTP headers alone do not
    // authenticate them through Vercel Deployment Protection.
    await context.request.get(origin, { headers: { ...protectedHeaders, 'x-vercel-set-bypass-cookie': 'true' } });
  }
  const a = await first.newPage(), b = await second.newPage();
  const errors = []; a.on('pageerror', (error) => errors.push(error.message)); b.on('pageerror', (error) => errors.push(error.message));
  const suffix = randomUUID().replaceAll('-', '').slice(0, 10), password = randomUUID();
  try {
    for (const [page, username, displayName] of [[a, 'browser_a', '青山'], [b, 'browser_b', '松间']]) {
      await page.goto('/'); await page.getByRole('button', { name: '注册账号', exact: true }).click();
      await page.getByLabel('账号', { exact: true }).fill(`${username}_${suffix}`); await page.getByLabel('怎么称呼你').fill(displayName); await page.getByLabel('密码', { exact: true }).fill(password);
      await page.getByRole('button', { name: '创建账号，开始玩' }).click(); await expect(page.getByRole('button', { name: /创建房间/ })).toBeEnabled();
    }
    await a.screenshot({ path: info.outputPath('desktop-lobby.png'), fullPage: true });
    await a.getByRole('button', { name: /创建房间/ }).click();
    const code = await a.locator('.room-code-box strong').innerText();
    await b.getByLabel('房间码', { exact: true }).fill(code); await b.getByRole('button', { name: /加入房间/ }).click();
    await expect(a.getByRole('heading', { name: '轮到你落子了' })).toBeVisible();
    for (const column of ['A', 'B', 'C', 'D', 'E']) {
      await a.getByRole('button', { name: `${column}1 空位`, exact: true }).click();
      if (column !== 'E') { const cell = b.getByRole('button', { name: `${column}2 空位`, exact: true }); await expect(cell).toBeEnabled(); await cell.click(); }
    }
    await expect(a.getByRole('heading', { name: '青山 获胜' })).toBeVisible(); await expect(b.getByRole('heading', { name: '青山 获胜' })).toBeVisible();
    await a.reload(); await expect(a.getByRole('heading', { name: '青山 获胜' })).toBeVisible();
    await a.screenshot({ path: info.outputPath('desktop-match.png'), fullPage: true });
    await b.screenshot({ path: info.outputPath('mobile-match.png'), fullPage: true });
    expect(await b.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await a.getByRole('button', { name: '再来一局' }).click(); await b.getByRole('button', { name: '对手想再来一局' }).click();
    await expect(b.getByRole('heading', { name: '轮到你落子了' })).toBeVisible();
    await a.getByRole('button', { name: '退出', exact: true }).click(); await expect(a.getByRole('heading', { name: '欢迎回到同桌' })).toBeVisible();
    b.once('dialog', (dialog) => dialog.accept());
    await b.getByRole('button', { name: '离开房间', exact: true }).click();
    await expect(b.getByRole('button', { name: /创建房间/ })).toBeEnabled();
    await b.getByRole('button', { name: '退出', exact: true }).click();
    await expect(b.getByRole('heading', { name: '欢迎回到同桌' })).toBeVisible();
    expect(errors).toEqual([]);
  } finally { await first.close(); await second.close(); }
});
