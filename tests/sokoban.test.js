import test from 'node:test';
import assert from 'node:assert/strict';
import { Games } from '../server/game.js';
import { gateOpen, newSokoban } from '../server/sokoban.js';

const user = (id) => ({ id, displayName: `p${id}` });
function setup() {
  const games = new Games(); const room = games.create(user(1), { game: 'sokoban', mode: 'coop' }); games.join(user(2), room.id);
  const act = (id, kind, direction) => games.sokobanAction(id, { kind, direction, round: room.sokoban.round, revision: room.sokoban.revision }, [1, 2]);
  const walk = (id, x, y) => {
    const s = room.sokoban, queue = [[s.actors[id - 1], []]], seen = new Set();
    while (queue.length) {
      const [[a, b], path] = queue.shift();
      if (a === x && b === y) { for (const direction of path) act(id, 'move', direction); return; }
      const key = `${a},${b}`; if (seen.has(key)) continue; seen.add(key);
      for (const [d, dx, dy] of [['up',0,-1],['down',0,1],['left',-1,0],['right',1,0]]) {
        const nx=a+dx, ny=b+dy;
        if (nx<0 || ny<0 || nx>=s.width || ny>=s.height) continue;
        if ([...s.walls,...s.boxes,s.actors[2-id],...(!gateOpen(s) ? s.gates : [])].some(([px,py])=>px===nx&&py===ny)) continue;
        queue.push([[nx,ny],[...path,d]]);
      }
    }
    throw new Error(`No walk for ${id} to ${x},${y}`);
  };
  return { games, room, act, walk };
}
test('all three cooperative levels have legal solutions, shared consent and full replay', () => {
  const {games,room,act,walk}=setup();
  for(const id of [1,2]) {act(id,'move','up');act(id,'move','up');}
  assert.equal(room.sokoban.phase,'cleared'); act(1,'next'); assert.equal(room.sokoban.level,0); act(2,'next');
  act(2,'move','right');
  for(let i=0;i<4;i++) act(1,'move','right');
  walk(1,7,3);act(1,'move','left');walk(1,5,4);act(1,'move','up');
  walk(1,3,1);act(2,'move','left');walk(1,2,1);
  walk(2,6,5);act(2,'move','up');walk(2,7,3);for(let i=0;i<4;i++) act(2,'move','left');
  assert.equal(room.sokoban.phase,'cleared');act(1,'next');act(2,'next');
  act(2,'move','right');for(let i=0;i<4;i++) act(1,'move','right');
  walk(1,7,5);act(1,'move','up');walk(1,6,3);act(1,'move','right');
  walk(1,2,3);act(2,'move','left');walk(1,2,2);
  walk(2,9,4);for(let i=0;i<6;i++) act(2,'move','left');walk(2,2,3);act(2,'move','down');
  assert.equal(room.status,'finished');assert.equal(room.reason,'sokoban-complete');assert.deepEqual(room.sokoban.boxes,room.sokoban.goals);
  games.rematch(1);games.rematch(2);assert.equal(room.sokoban.level,0);assert.equal(room.status,'playing');
});
test('puzzle validates ownership, revisions, offline moves, undo and consent without changing old games', () => {
  const {games,room,act}=setup();
  const old = [games.create(user(3)),games.create(user(5),{game:'snake',mode:'coop'}),games.create(user(7),{game:'snake',mode:'versus'})];
  games.join(user(4),old[0].id);games.join(user(6),old[1].id);games.join(user(8),old[2].id);
  const saved=structuredClone(old), command={kind:'move',direction:'up',round:0,revision:0};
  assert.throws(()=>games.sokobanAction(1,command,[1]),/上线/);
  assert.throws(()=>games.sokobanAction(3,command,[3,4]),/不是/);
  assert.throws(()=>games.move(1,0,0),/不是五子棋/);
  act(1,'move','up');assert.throws(()=>games.sokobanAction(2,command,[1,2]),/同步/);
  assert.throws(()=>act(2,'undo'),/只能撤销/);act(1,'undo');assert.equal(room.sokoban.moves,0);
  act(1,'restart');assert.equal(room.sokoban.round,0);act(2,'restart');assert.equal(room.sokoban.round,1);
  assert.throws(()=>games.sokobanAction(1,command,[1,2]),/关卡已更新/);
  assert.throws(()=>act(1,'next'),/先完成/);act(1,'move','up');act(1,'move','up');
  assert.throws(()=>act(1,'move','up'),/没有空间/);
  assert.deepEqual(old,saved);
  games.resign(1);games.rematch(1);games.rematch(2);games.leave(1);assert.deepEqual(old,saved);
});

test('gates require a teammate, cannot close onto occupants, and wrong-color crates cannot move', () => {
  const {room,act,walk}=setup();room.sokoban=newSokoban(1);
  act(1,'move','right');assert.throws(()=>act(1,'move','right'),/没有空间/);
  act(2,'move','right');act(1,'move','right');
  assert.throws(()=>act(2,'move','left'),/门内/);
  act(1,'move','right');assert.throws(()=>act(2,'move','left'),/门内/);
  act(1,'move','right');act(2,'move','left');assert.equal(gateOpen(room.sokoban),false);
  act(2,'move','right');walk(1,5,4);assert.throws(()=>act(1,'move','right'),/自己颜色/);
});
