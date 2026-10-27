import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { GAME_CATALOG } from '../../shared/games.js';

for (const mobile of [false, true]) test(`game help: all games and modes on ${mobile ? 'mobile' : 'desktop'}`, async ({ browser }) => {
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1100 }, isMobile: mobile });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', dialog => dialog.accept());
  try {
    await page.goto('/');
    await page.getByRole('button', { name: '注册账号', exact: true }).click();
    await page.getByLabel('账号', { exact: true }).fill(`help_${randomUUID().replaceAll('-', '').slice(0, 10)}`);
    await page.getByLabel('怎么称呼你').fill('玩法测试');
    await page.getByLabel('密码', { exact: true }).fill(randomUUID());
    await page.getByRole('button', { name: '创建账号，开始玩' }).click();
    for (const [game, info] of Object.entries(GAME_CATALOG)) for (const [mode, label] of Object.entries(info.modes)) {
      await page.getByRole('button', { name: `选择${info.name}`, exact: true }).click();
      await page.getByRole('radio', { name: label, exact: true }).check();
      await page.getByRole('button', { name: /^创建房间/ }).click();
      await expect(page.locator('.room-code-box strong')).toBeVisible();
      const code = await page.locator('.room-code-box strong').innerText();
      const help = page.getByRole('region', { name: '游戏玩法' });
      const button = help.getByRole('button', { name: '玩法说明', exact: true });
      await expect(button).toHaveAttribute('aria-expanded', 'false');
      await expect(help.getByRole('heading')).toBeHidden();
      await button.click();
      await expect(button).toHaveAttribute('aria-expanded', 'true');
      await expect(help.getByRole('heading')).toHaveText(`${info.name} · ${label}玩法`);
      expect(await help.getByRole('listitem').count()).toBeGreaterThanOrEqual(2);
      if (game === 'snake') await expect(help).toContainText(mode === 'coop' ? '合计吃到 20 个食物' : '活到最后获胜');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await button.focus();
      await page.keyboard.press('Enter');
      await expect(button).toHaveAttribute('aria-expanded', 'false');
      await expect(help.getByRole('heading')).toBeHidden();
      await expect(page.locator('.room-code-box strong')).toHaveText(code);
      await page.getByRole('button', { name: '离开房间', exact: true }).click();
      await expect(page.getByRole('button', { name: `选择${info.name}`, exact: true })).toBeVisible();
    }
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});
