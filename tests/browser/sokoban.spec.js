import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';

test('cooperative puzzle: desktop/mobile moves, undo, consent, progression and reconnect', async ({ browser }, info) => {
  const contexts = [await browser.newContext({viewport:{width:1440,height:1100}}),await browser.newContext({viewport:{width:390,height:844},isMobile:true})];
  const a=await contexts[0].newPage();let b=await contexts[1].newPage();const errors=[];
  const watch=p=>p.on('pageerror',e=>errors.push(e.message));watch(a);watch(b);
  try {
    for(const p of [a,b]) {
      await p.goto('/');await p.getByRole('button',{name:'注册账号',exact:true}).click();
      await p.getByLabel('账号',{exact:true}).fill(`puzzle_${randomUUID().slice(0,8)}`);
      await p.getByLabel('怎么称呼你').fill(p===a?'搬运一号':'搬运二号');await p.getByLabel('密码',{exact:true}).fill(randomUUID());
      await p.getByRole('button',{name:'创建账号，开始玩'}).click();
      await expect(p.getByRole('button',{name:'选择默契搬运队',exact:true})).toBeEnabled();
    }
    await a.getByRole('button',{name:'选择默契搬运队',exact:true}).click();
    await expect(a.getByRole('radio',{name:'双人合作',exact:true})).toBeChecked();
    await a.getByRole('button',{name:/^创建房间/}).click();
    const code=await a.locator('.room-code-box strong').innerText();
    await b.getByLabel('房间码',{exact:true}).fill(code);
    await b.getByRole('complementary',{name:'加入房间'}).getByRole('button',{name:/加入房间/}).click();
    await expect(b.getByTestId('sokoban-board')).toHaveAttribute('data-moves','0');
    async function move(p,d='向上') {
      const previous=Number(await p.getByTestId('sokoban-board').getAttribute('data-moves'));
      await p.getByRole('button',{name:d,exact:true}).click();
      for(const page of [a,b]) await expect(page.getByTestId('sokoban-board')).toHaveAttribute('data-moves',String(previous+1));
    }
    await expect(a.getByRole('button',{name:'向上',exact:true})).toBeEnabled();
    await a.keyboard.press('ArrowUp');await expect(b.getByTestId('sokoban-box-0')).toHaveAttribute('data-y','2');
    await a.getByRole('button',{name:'撤销我的最后一步',exact:true}).click();
    await expect(b.getByTestId('sokoban-board')).toHaveAttribute('data-moves','0');
    await move(a);await move(a);await move(b);await move(b);
    for(const p of [a,b]) await expect(p.getByRole('heading',{name:'本关完成！',exact:true})).toBeVisible();
    await a.getByRole('button',{name:'准备下一关',exact:true}).click();
    await expect(a.getByTestId('sokoban-board')).toHaveAttribute('data-level','0');
    await b.getByRole('button',{name:'一起进入下一关',exact:true}).click();
    await expect(a.getByTestId('sokoban-board')).toHaveAttribute('data-level','1');
    await move(b,'向右');await move(a,'向右');await move(a,'向右');
    await expect(a.getByText('机关门已打开',{exact:true})).toBeVisible();
    const saved=await a.getByTestId('sokoban-board').getAttribute('data-moves');await b.close();
    await expect(a.getByRole('button',{name:'向上',exact:true})).toBeDisabled();
    b=await contexts[1].newPage();watch(b);await b.goto('/');
    await expect(b.getByTestId('sokoban-board')).toHaveAttribute('data-moves',saved);
    await a.getByRole('button',{name:'申请重开本关',exact:true}).click();
    await expect(b.getByTestId('sokoban-board')).toHaveAttribute('data-moves',saved);
    await b.getByRole('button',{name:'同意重开本关',exact:true}).click();
    await expect(a.getByTestId('sokoban-board')).toHaveAttribute('data-moves','0');
    await a.screenshot({path:info.outputPath('sokoban-desktop.png'),fullPage:true});await b.screenshot({path:info.outputPath('sokoban-mobile.png'),fullPage:true});
    expect(await b.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    a.once('dialog',d=>d.accept());await a.getByRole('button',{name:'离开房间',exact:true}).click();
    await expect(b.getByRole('button',{name:'选择默契搬运队',exact:true})).toBeEnabled();expect(errors).toEqual([]);
  } finally {for(const c of contexts) await c.close();}
});
