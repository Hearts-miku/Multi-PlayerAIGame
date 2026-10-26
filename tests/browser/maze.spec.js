import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mazePath } from '../helpers/maze-path.js';

test('maze: random rooms, shared fog, both treasure owners, reconnect, consent and fresh replay',async({browser})=>{
 test.setTimeout(process.env.LIVE_BASE_URL?240000:90000);
 const contexts=[await browser.newContext({viewport:{width:1440,height:1100}}),await browser.newContext({viewport:{width:390,height:844},isMobile:true})];
 const pages=await Promise.all(contexts.map(c=>c.newPage())),states=new Map(),errors=[];
 const watch=p=>{p.on('pageerror',e=>errors.push(e.message));p.on('websocket',ws=>ws.on('framereceived',({payload})=>{const frame=String(payload);if(frame.startsWith('42[')){const [event,room]=JSON.parse(frame.slice(2));if(event==='room:update'&&room?.game==='maze')states.set(p,room);}}));};pages.forEach(watch);
 try {
  for(const [i,p]of pages.entries()){
   await p.goto('/');await p.getByRole('button',{name:'注册账号',exact:true}).click();await p.getByLabel('账号',{exact:true}).fill(`maze_${randomUUID().replaceAll('-','').slice(0,10)}`);await p.getByLabel('怎么称呼你').fill(`寻宝搭档${i+1}`);await p.getByLabel('密码',{exact:true}).fill(randomUUID());await p.getByRole('button',{name:'创建账号，开始玩'}).click();await expect(p.getByRole('button',{name:'选择迷雾寻宝',exact:true})).toBeEnabled();
  }
  await pages[0].getByRole('button',{name:'选择迷雾寻宝',exact:true}).click();const dialog=pages[0].getByRole('dialog',{name:'迷雾寻宝 · 创建房间'});await expect(dialog).toBeVisible();await expect(dialog.getByRole('radio',{name:'双人合作',exact:true})).toBeChecked();await dialog.getByRole('button',{name:/^创建房间/}).click();await expect(pages[0].locator('.room-code-box strong')).toBeVisible();const code=await pages[0].locator('.room-code-box strong').innerText();
  await pages[1].getByLabel('房间码',{exact:true}).fill(code);await pages[1].getByRole('complementary',{name:'加入房间'}).getByRole('button',{name:/加入房间/}).click();
  for(const p of pages)await expect(p.getByRole('button',{name:'向上',exact:true})).toBeEnabled();
  const initial=structuredClone(states.get(pages[0]).maze);
  async function synced(revision){for(const p of pages)await expect(p.getByTestId('maze-board')).toHaveAttribute('data-revision',String(revision));}
  async function click(i,locator){await expect(locator).toBeEnabled();const rev=states.get(pages[i]).maze.revision;await locator.click();await synced(rev+1);}
  const labels={up:'向上',down:'向下',left:'向左',right:'向右'};
  async function move(i,direction,keyboard=false){if(keyboard){const rev=states.get(pages[i]).maze.revision;await pages[i].bringToFront();await pages[i].getByRole('button',{name:labels[direction],exact:true}).focus();await pages[i].keyboard.press({up:'ArrowUp',down:'ArrowDown',left:'ArrowLeft',right:'ArrowRight'}[direction]);await synced(rev+1);}else await click(i,pages[i].getByRole('button',{name:labels[direction],exact:true}));const s=states.get(pages[i]).maze;for(const p of pages){await expect(p.getByTestId(`maze-player-${i}`)).toHaveAttribute('data-position',String(s.actors[i]));await expect(p.getByTestId(`maze-cell-${s.actors[i]}`)).toHaveAttribute('data-seen','true');}await pages[i].waitForTimeout(60);}
  await move(0,mazePath(initial,initial.actors[0],initial.exit)[0],true);
  const saved=structuredClone(states.get(pages[0]).maze);await pages[1].close();await expect(pages[0].getByRole('heading',{name:'等队友回来继续',exact:true})).toBeVisible();await expect(pages[0].getByRole('button',{name:'向上',exact:true})).toBeDisabled();
  pages[1]=await contexts[1].newPage();watch(pages[1]);await pages[1].goto('/');await synced(saved.revision);expect(states.get(pages[1]).maze).toEqual(saved);
  await click(0,pages[0].getByRole('button',{name:'重走这张地图',exact:true}));await click(1,pages[1].getByRole('button',{name:'同意重走这张地图',exact:true}));expect(states.get(pages[0]).maze.seed).toBe(initial.seed);expect(states.get(pages[0]).maze.treasures).toEqual(initial.treasures);
  await click(0,pages[0].getByRole('button',{name:'换张随机地图',exact:true}));await click(1,pages[1].getByRole('button',{name:'同意换张随机地图',exact:true}));const s=states.get(pages[0]).maze;expect(s.seed).not.toBe(initial.seed);
  for(let i=0;i<2;i++)for(const to of [...s.treasures.filter(t=>t.owner===i).map(t=>t.at),s.exit]){
   const current=states.get(pages[i]).maze;
   for(const direction of mazePath(current,current.actors[i],to)){if(states.get(pages[i]).status==='finished')break;await move(i,direction);}
  }
  for(const p of pages){await expect(p.getByRole('heading',{name:'宝物到手，一起回家！',exact:true})).toBeVisible();expect(states.get(p).maze.treasures.every(t=>t.collected)).toBe(true);expect(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
  await pages[0].getByRole('button',{name:'再来一局',exact:true}).click();await pages[1].getByRole('button',{name:'接受再来一局',exact:true}).click();for(const p of pages){await expect(p.getByRole('button',{name:'向上',exact:true})).toBeEnabled();expect(states.get(p).maze.seed).not.toBe(s.seed);}
  pages[0].once('dialog',d=>d.accept());await pages[0].getByRole('button',{name:'离开房间',exact:true}).click();await expect(pages[1].getByRole('button',{name:'选择迷雾寻宝',exact:true})).toBeEnabled();expect(errors).toEqual([]);
 } finally {for(const c of contexts)await c.close();}
});
