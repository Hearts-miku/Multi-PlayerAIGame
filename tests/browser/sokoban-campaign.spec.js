import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { campaignSolution } from '../helpers/sokoban-solution.js';

test('eleven-level campaign: two browsers solve every cooperative circuit and finish together', async ({browser},info) => {
  test.setTimeout(process.env.LIVE_BASE_URL ? 600_000 : 300_000);
  const contexts=[await browser.newContext({viewport:{width:1440,height:1100}}),await browser.newContext({viewport:{width:390,height:844},isMobile:true})];
  const pages=await Promise.all(contexts.map(c=>c.newPage())),errors=[];
  pages.forEach(p=>p.on('pageerror',e=>errors.push(e.message)));
  const {steps}=campaignSolution();
  try {
    for(const [i,p] of pages.entries()) {
      await p.goto('/');await p.getByRole('button',{name:'注册账号',exact:true}).click();
      await p.getByLabel('账号',{exact:true}).fill(`exp_${randomUUID().slice(0,8)}`);
      await p.getByLabel('怎么称呼你').fill(`机关搭档${i+1}`);await p.getByLabel('密码',{exact:true}).fill(randomUUID());
      await p.getByRole('button',{name:'创建账号，开始玩'}).click();
      await expect(p.getByRole('button',{name:'选择默契搬运队',exact:true})).toBeEnabled();
    }
    await pages[0].getByRole('button',{name:'选择默契搬运队',exact:true}).click();
    const creator=pages[0].getByRole('dialog',{name:'默契搬运队 · 创建房间'});
    await expect(creator).toBeVisible();
    await creator.getByLabel('起始关卡',{exact:true}).selectOption('0');
    await expect(creator.getByRole('radio',{name:'双人合作',exact:true})).toBeChecked();
    await creator.getByRole('button',{name:/^创建房间/}).click();
    // Fail at room creation, rather than consuming the entire campaign timeout.
    await expect(pages[0].locator('.room-code-box strong')).toBeVisible();
    const code=await pages[0].locator('.room-code-box strong').innerText();
    await pages[1].getByLabel('房间码',{exact:true}).fill(code);
    await pages[1].getByRole('complementary',{name:'加入房间'}).getByRole('button',{name:/加入房间/}).click();
    for(const p of pages)await expect(p.getByRole('button',{name:'向上',exact:true})).toBeEnabled();
    for(const step of steps) {
      const p=pages[step.player-1];
      if(step.kind==='next') await p.getByRole('button',{name:step.player===1?'准备下一关':'一起进入下一关',exact:true}).click();
      else await p.getByRole('button',{name:{up:'向上',down:'向下',left:'向左',right:'向右'}[step.direction],exact:true}).click();
      for(const page of pages) await expect(page.getByTestId('sokoban-board')).toHaveAttribute('data-revision',String(step.revision));
      if(step.level>=3) for(const gate of step.gates) for(const page of pages) {
        await expect(page.getByTestId(`sokoban-gate-${gate.at.join('-')}`)).toHaveAttribute('data-open',String(gate.open));
      }
      // Pace real inputs below the production 20 actions/second limit.
      await p.waitForTimeout(60);
      if(step.level===7&&step.latches.includes('C')&&step.moves===steps.find(s=>s.level===7&&s.latches.includes('C')).moves) {
        for(const [i,page] of pages.entries())await page.screenshot({path:info.outputPath(`advanced-circuits-${i}.png`),fullPage:true});
        expect(await pages[1].evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      }
    }
    for(const p of pages)await expect(p.getByRole('heading',{name:'默契满分，全部通关！',exact:true})).toBeVisible();
    await pages[0].getByRole('button',{name:'重新挑战全部关卡',exact:true}).click();
    await pages[1].getByRole('button',{name:'接受重新挑战',exact:true}).click();
    for(const p of pages)await expect(p.getByTestId('sokoban-board')).toHaveAttribute('data-level','0');
    pages[0].once('dialog',d=>d.accept());await pages[0].getByRole('button',{name:'离开房间',exact:true}).click();
    await expect(pages[1].getByRole('button',{name:'选择默契搬运队',exact:true})).toBeEnabled();expect(errors).toEqual([]);
  } finally {for(const c of contexts)await c.close();}
});
