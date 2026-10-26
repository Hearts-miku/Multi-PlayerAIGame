import test from 'node:test';
import assert from 'node:assert/strict';
import { Games } from '../server/game.js';
import { gateOpen, newSokoban } from '../server/sokoban.js';
import { plateActive } from '../shared/sokoban-mechanics.js';
import { SOKOBAN_LEVELS } from '../shared/sokoban-levels.js';
import { campaignSolution } from './helpers/sokoban-solution.js';

const user = (id) => ({ id, displayName: `p${id}` });
test('room creation accepts every start level, defaults to first, and rejects invalid input atomically', () => {
  const games=new Games();
  for(let level=0;level<SOKOBAN_LEVELS.length;level++) {
    const room=games.create(user(level+10),{game:'sokoban',mode:'coop',startLevel:level});
    assert.deepEqual(room.sokoban,newSokoban(level));assert.equal(room.status,'waiting');
  }
  const saved=structuredClone(games.list());
  for(const startLevel of [-1,SOKOBAN_LEVELS.length,1.5,'7',null,{},NaN]) assert.throws(()=>games.create(user(99),{game:'sokoban',mode:'coop',startLevel}),/起始关卡/);
  assert.deepEqual(games.list(),saved);
  assert.equal(games.create(user(99),{game:'sokoban',mode:'coop'}).sokoban.level,0);
  assert.equal(games.create(user(100),{game:'gomoku',startLevel:7}).sokoban,undefined);
  assert.equal(games.create(user(101),{game:'snake',mode:'coop',startLevel:7}).sokoban,undefined);
});
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
test('legacy three-level campaigns retain their rules, consent and completion; replay upgrades to the current campaign', () => {
  const {games,room,act,walk}=setup();
  room.sokoban.totalLevels=3;delete room.sokoban.latches;
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
  assert.equal(room.sokoban.totalLevels,SOKOBAN_LEVELS.length);
});

test('all eleven levels are solvable through ordinary multiplayer moves and shared consent', () => {
  assert.equal(SOKOBAN_LEVELS.length,11);
  const {steps,room}=campaignSolution();
  assert.equal(steps.filter(s=>s.kind==='next').length,(SOKOBAN_LEVELS.length-1)*2);
  for(let level=0;level<SOKOBAN_LEVELS.length;level++) {
    const moves=steps.filter(s=>s.level===level&&s.kind==='move');
    assert.deepEqual([...new Set(moves.map(s=>s.player))].sort(),[1,2]);
    assert.equal(moves.at(-1).phase,'cleared');
  }
  assert.equal(room.reason,'sokoban-complete');assert.deepEqual(room.sokoban.boxes,room.sokoban.goals);
  const a=newSokoban(7),b=newSokoban(7);a.circuits[0].plates[0].at[0]=99;assert.equal(b.circuits[0].plates[0].at[0],2);
});

test('colored circuits are independent; weight plates require the correct box and all inputs', () => {
  const {room,act}=setup();room.sokoban=newSokoban(3);
  assert.equal(gateOpen(room.sokoban,[5,2]),false);act(2,'move','right');
  assert.equal(gateOpen(room.sokoban,[5,2]),true);assert.equal(gateOpen(room.sokoban,[5,6]),false);
  for(let i=0;i<3;i++)act(1,'move','right');
  assert.throws(()=>act(2,'move','left'),/门内/);
  const plate=room.sokoban.circuits[0].plates[0];
  assert.equal(plateActive({...room.sokoban,actors:[[2,4],[1,4]]},plate),false);
  room.sokoban=newSokoban(6);
  act(1,'move','up');assert.equal(gateOpen(room.sokoban,[5,3]),false);
  act(2,'move','up');assert.equal(gateOpen(room.sokoban,[5,3]),true);
  act(2,'undo');assert.equal(gateOpen(room.sokoban,[5,3]),false);
  assert.equal(plateActive({...room.sokoban,actors:[[2,2],[3,4]],boxes:[[2,3],[3,3]]},room.sokoban.circuits[0].plates[0]),false);
  const relay=newSokoban(7), relayPlate=relay.circuits[1].plates[0];
  assert.equal(plateActive({...relay,actors:[[2,4],[7,2]]},relayPlate),true);
  assert.equal(plateActive({...relay,boxes:[[2,3],[7,2]]},relayPlate),true);
  assert.equal(plateActive({...relay,actors:[[7,2],[3,4]]},relayPlate),false);
});

test('dual latch requires both players at once, persists when leaving, and undo/restart restores it', () => {
  const {room,act,walk}=setup();room.sokoban=newSokoban(5);
  walk(1,2,2);assert.deepEqual(room.sokoban.latches,[]);
  walk(2,3,5);act(2,'move','down');assert.deepEqual(room.sokoban.latches,['A']);
  act(2,'undo');assert.deepEqual(room.sokoban.latches,[]);assert.equal(gateOpen(room.sokoban,[5,4]),false);
  act(2,'move','down');act(1,'move','left');assert.equal(gateOpen(room.sokoban,[5,4]),true);
  act(1,'restart');act(2,'restart');assert.deepEqual(room.sokoban.latches,[]);
  assert.equal(room.sokoban.level,5);assert.equal(room.sokoban.moves,0);
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

test('legacy eight-level campaign finishes without migrating an active room',()=>{
 const {room}=campaignSolution(8);assert.equal(room.status,'finished');assert.equal(room.sokoban.level,7);assert.equal(room.sokoban.totalLevels,8);
});
