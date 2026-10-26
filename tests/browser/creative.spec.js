import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { LIGHT_LEVELS, switchOwner } from '../../shared/lights.js';
for(const game of ['lights','gravity'])test(`${game}: two players create, play, reconnect, finish and replay on desktop/mobile`,async({browser},info)=>{
 const name=game==='lights'?'星灯维修站':'引力四连';
 const contexts=[await browser.newContext({viewport:{width:1440,height:1100}}),await browser.newContext({viewport:{width:390,height:844},isMobile:true})];
 const pages=await Promise.all(contexts.map(c=>c.newPage())),errors=[];
 const watch=p=>p.on('pageerror',e=>errors.push(e.message));pages.forEach(watch);
 try{
  for(const [i,p] of pages.entries()){
   await p.goto('/');await p.getByRole('button',{name:'注册账号',exact:true}).click();
   await p.getByLabel('账号',{exact:true}).fill(`new_${randomUUID().replaceAll('-','').slice(0,10)}`);await p.getByLabel('怎么称呼你').fill(`创意搭档${i+1}`);await p.getByLabel('密码',{exact:true}).fill(randomUUID());
   await p.getByRole('button',{name:'创建账号，开始玩'}).click();await expect(p.getByRole('button',{name:`选择${name}`,exact:true})).toBeEnabled();
  }
  await pages[0].getByRole('button',{name:`选择${name}`,exact:true}).click();await expect(pages[0].getByLabel('起始关卡',{exact:true})).toHaveCount(0);
  await pages[0].getByRole('button',{name:/^创建房间/}).click();
  const code=await pages[0].locator('.room-code-box strong').innerText();
  await pages[1].getByLabel('房间码',{exact:true}).fill(code);await pages[1].getByRole('complementary',{name:'加入房间'}).getByRole('button',{name:/加入房间/}).click();
  for(const p of pages)await expect(p.getByTestId(`${game}-board`)).toHaveAttribute('data-revision','0');
  async function click(i,locator){
   await expect(locator).toBeEnabled();const revision=Number(await pages[i].getByTestId(`${game}-board`).getAttribute('data-revision'));
   await locator.click();for(const p of pages)await expect(p.getByTestId(`${game}-board`)).toHaveAttribute('data-revision',String(revision+1));
  }
  if(game==='lights'){
   await expect(pages[0].getByTestId('light-1')).toBeDisabled();await expect(pages[1].getByTestId('light-0')).toBeDisabled();
   await click(0,pages[0].getByTestId('light-0'));
  }else{
   await expect(pages[1].getByRole('button',{name:'投放第 1 列',exact:true})).toBeDisabled();
   await click(0,pages[0].getByRole('button',{name:'投放第 1 列',exact:true}));await expect(pages[1].getByTestId('gravity-cell-35')).toHaveAttribute('data-color','1');
  }
  await pages[1].close();await expect(pages[0].getByRole('heading',{name:game==='lights'?'等队友回来继续':'等对手回来继续',exact:true})).toBeVisible();
  pages[1]=await contexts[1].newPage();watch(pages[1]);await pages[1].goto('/');await expect(pages[1].getByTestId(`${game}-board`)).toHaveAttribute('data-revision','1');
  if(game==='lights'){
   await click(0,pages[0].getByRole('button',{name:'申请重开本关',exact:true}));await click(1,pages[1].getByRole('button',{name:'同意重开本关',exact:true}));
   for(let level=0;level<LIGHT_LEVELS.length;level++){
    for(const p of pages){
     await expect(p.locator('.table-heading small')).toHaveText(`第 ${level+1} / ${LIGHT_LEVELS.length} 关`);
     await expect(p.getByRole('heading',{name:LIGHT_LEVELS[level].name,exact:true})).toBeVisible();
    }
    for(const index of LIGHT_LEVELS[level].scramble){const player=switchOwner(index,LIGHT_LEVELS[level].size);await click(player,pages[player].getByTestId(`light-${index}`));}
    for(const p of pages){await expect(p.getByTestId('lights-board')).toHaveAttribute('data-phase','cleared');await expect(p.locator('.lights-cell[data-lit="true"]')).toHaveCount(LIGHT_LEVELS[level].size**2);}
    if(level<LIGHT_LEVELS.length-1){await click(0,pages[0].getByRole('button',{name:'准备下一关',exact:true}));await click(1,pages[1].getByRole('button',{name:'一起进入下一关',exact:true}));}
   }
   for(const p of pages)await expect(p.getByRole('heading',{name:'整片星空，因你们亮起！',exact:true})).toBeVisible();
  }else{
   await click(1,pages[1].getByRole('button',{name:'翻转重力（剩余 1 次）',exact:true}));
   for(const p of pages){await expect(p.getByTestId('gravity-board')).toHaveAttribute('data-direction','up');await expect(p.getByTestId('gravity-cell-0')).toHaveAttribute('data-color','1');await expect(p.getByTestId('gravity-cell-35')).toHaveAttribute('data-color','0');}
   for(let col=2;col<=4;col++){
    await click(0,pages[0].getByRole('button',{name:`投放第 ${col} 列`,exact:true}));
    if(col<4)await click(1,pages[1].getByRole('button',{name:'投放第 7 列',exact:true}));
   }
   for(const p of pages)await expect(p.getByRole('heading',{name:'创意搭档1 获胜',exact:true})).toBeVisible();
  }
  for(const [i,p] of pages.entries()){expect(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await p.screenshot({path:info.outputPath(`${game}-${i}.png`),fullPage:true});}
  await pages[0].getByRole('button',{name:'再来一局',exact:true}).click();await pages[1].getByRole('button',{name:'接受再来一局',exact:true}).click();
  if(game==='lights')for(const p of pages)await expect(p.getByTestId('lights-board')).toHaveAttribute('data-level','0');
  else for(const p of pages){await expect(p.getByTestId('gravity-cell-0')).toHaveAttribute('data-color','0');await expect(p.getByTestId('gravity-board')).toHaveAttribute('data-direction','down');}
  pages[0].once('dialog',d=>d.accept());await pages[0].getByRole('button',{name:'离开房间',exact:true}).click();await expect(pages[1].getByRole('button',{name:`选择${name}`,exact:true})).toBeEnabled();expect(errors).toEqual([]);
 }finally{for(const c of contexts)await c.close();}
});
