import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';

for (const mode of ['versus', 'coop']) test(`snake ${mode}: desktop + mobile controls, shared result and replay`, async ({ browser }, info) => {
  const headers = process.env.VERCEL_AUTOMATION_BYPASS_SECRET ? { 'x-vercel-protection-bypass': process.env.VERCEL_AUTOMATION_BYPASS_SECRET } : {};
  const contexts = [await browser.newContext({ viewport: { width: 1440, height: 1100 }, extraHTTPHeaders: headers }), await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, extraHTTPHeaders: headers })];
  if (process.env.VERCEL_AUTOMATION_BYPASS_SECRET) for (const context of contexts) {
    const origin = new URL(process.env.LIVE_BASE_URL).origin;
    await context.route('**/*', (route) => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await context.request.get(origin, { headers: { ...headers, 'x-vercel-set-bypass-cookie': 'true' } });
  }
  const a = await contexts[0].newPage(); let b = await contexts[1].newPage();
  const errors = [], watch = (page) => page.on('pageerror', (error) => errors.push(error.message)); watch(a); watch(b);
  const suffix = randomUUID().replaceAll('-', '').slice(0, 10);
  try {
    for (const [page, username, name] of [[a, 'snake_a', '青柠'], [b, 'snake_b', '蓝莓']]) {
      await page.goto('/'); await page.getByRole('button', { name: '注册账号', exact: true }).click();
      await page.getByLabel('账号', { exact: true }).fill(`${username}_${suffix}`);
      await page.getByLabel('怎么称呼你').fill(name); await page.getByLabel('密码', { exact: true }).fill(randomUUID());
      await page.getByRole('button', { name: '创建账号，开始玩' }).click();
      await expect(page.getByRole('button', { name: '选择贪食蛇', exact: true })).toBeEnabled();
    }
    await expect(a.getByRole('radio', { name: '贪食蛇', exact: true })).toHaveCount(0);
    await a.getByRole('button', { name: '选择贪食蛇', exact: true }).click();
    await expect(a.getByRole('dialog', { name: '贪食蛇 · 创建房间' })).toBeVisible();
    await a.getByRole('radio', { name: '双人合作', exact: true }).check();
    await a.keyboard.press('Escape');
    await expect(a.getByRole('dialog')).not.toBeVisible();
    await expect(a.getByRole('button', { name: '选择贪食蛇', exact: true })).toBeFocused();
    await a.getByRole('button', { name: '选择五子棋', exact: true }).focus();
    await a.keyboard.press('Enter');
    await expect(a.getByRole('dialog', { name: '五子棋 · 创建房间' })).toBeVisible();
    await expect(a.getByRole('radio', { name: '双人合作', exact: true })).toHaveCount(0);
    await a.getByRole('button', { name: '取消', exact: true }).click();
    await a.getByRole('button', { name: '选择贪食蛇', exact: true }).click();
    await a.getByRole('radio', { name: mode === 'coop' ? '双人合作' : '双人对战', exact: true }).check();
    await b.getByRole('button', { name: '选择贪食蛇', exact: true }).click();
    await expect(b.getByRole('dialog')).toBeInViewport();
    await expect(b.getByRole('radio', { name: '双人对战', exact: true })).toBeInViewport();
    await b.screenshot({ path: info.outputPath('mobile-create-dialog.png'), fullPage: true });
    await b.getByRole('button', { name: '关闭创建房间', exact: true }).click();
    await expect(a.locator('.room-code-box')).toHaveCount(0);
    await a.getByRole('button', { name: /^创建房间/ }).click();
    const code = await a.locator('.room-code-box strong').innerText();
    if (mode === 'coop') {
      await b.locator('.room-list article').filter({ hasText: code }).getByRole('button', { name: /加入房间/ }).click();
    } else {
      await b.goto(`/?room=${code}`);
      await expect(b.getByLabel('房间码', { exact: true })).toHaveValue(code);
      await b.getByRole('complementary', { name: '加入房间' }).getByRole('button', { name: /加入房间/ }).click();
    }
    await expect(b.getByTestId('snake-board')).toHaveAttribute('data-phase', 'ready');
    await a.getByRole('button', { name: '准备开始', exact: true }).click();
    await b.getByRole('button', { name: '准备开始', exact: true }).click();
    await expect(a.getByTestId('snake-board')).toHaveAttribute('data-phase', 'running');
    if (mode === 'coop') {
      await expect(a.getByRole('progressbar', { name: '合作收集进度' })).toHaveAttribute('value', '2', { timeout: 15_000 });
      await expect(b.getByRole('progressbar', { name: '合作收集进度' })).toHaveAttribute('value', '2');
      await b.close();
      await expect(a.getByTestId('snake-board')).toHaveAttribute('data-phase', 'paused', { timeout: 15_000 });
      const savedTick = await a.getByTestId('snake-board').getAttribute('data-tick');
      b = await contexts[1].newPage(); watch(b); await b.goto('/');
      await expect(b.getByTestId('snake-board')).toHaveAttribute('data-phase', 'paused');
      await expect(b.getByTestId('snake-board')).toHaveAttribute('data-tick', savedTick);
      await a.getByRole('button', { name: '准备继续', exact: true }).click();
      await b.getByRole('button', { name: '准备继续', exact: true }).click();
      await expect(a.getByTestId('snake-board')).toHaveAttribute('data-phase', 'running');
      await expect(b.getByTestId('snake-board')).toHaveAttribute('data-phase', 'running');
    }
    // Keyboard and mobile controls must change actual authoritative positions.
    // Player B's ready click leaves A in a background tab. Activate A and
    // focus its enabled control before sending a real keyboard event.
    await a.bringToFront();
    const desktopUp = a.getByRole('button', { name: '向上', exact: true });
    await expect(desktopUp).toBeEnabled();
    await desktopUp.focus();
    await expect(desktopUp).toBeFocused();
    await a.keyboard.press('ArrowUp'); await b.getByRole('button', { name: '向上', exact: true }).click();
    await expect.poll(async () => Number(await a.getByTestId('snake-head-0').getAttribute('data-y')), { timeout: 15_000 }).toBeLessThan(6);
    await expect.poll(async () => Number(await b.getByTestId('snake-head-1').getAttribute('data-y'))).toBeLessThan(17);
    await a.screenshot({ path: info.outputPath('snake-desktop.png'), fullPage: true });
    await b.screenshot({ path: info.outputPath('snake-mobile.png'), fullPage: true });
    expect(await b.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const result = mode === 'coop' ? '合作挑战结束' : '蓝莓 获胜';
    await expect(a.getByRole('heading', { name: result, exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(b.getByRole('heading', { name: result, exact: true })).toBeVisible();
    await a.getByRole('button', { name: '再来一局', exact: true }).click();
    await b.getByRole('button', { name: '接受再来一局', exact: true }).click();
    await expect(a.getByTestId('snake-board')).toHaveAttribute('data-phase', 'ready');
    await expect(b.getByTestId('snake-board')).toHaveAttribute('data-tick', '0');
    a.once('dialog', (dialog) => dialog.accept()); await a.getByRole('button', { name: '离开房间', exact: true }).click();
    await expect(b.getByRole('button', { name: '选择贪食蛇', exact: true })).toBeEnabled();
    for (const page of [a, b]) { await page.getByRole('button', { name: '退出', exact: true }).click(); await expect(page.getByRole('heading', { name: '欢迎回到同桌' })).toBeVisible(); }
    expect(errors).toEqual([]);
  } finally { for (const context of contexts) await context.close(); }
});
