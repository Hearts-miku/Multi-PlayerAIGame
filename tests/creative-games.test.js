import test from 'node:test';
import assert from 'node:assert/strict';
import { newLights } from '../server/lights.js';
import { Games } from '../server/game.js';
import { LIGHT_LEVELS, switchOwner, toggleLights } from '../shared/lights.js';
import { gravityLines } from '../server/gravity.js';
const user=id=>({id,displayName:`p${id}`});
function setup(game){const games=new Games(),room=games.create(user(1),{game,mode:game==='lights'?'coop':'versus'});games.join(user(2),room.id);const act=(id,command)=>games[`${game}Action`](id,{round:room[game].round,revision:room[game].revision,...command},[1,2]);return{games,room,act};}
test('lights: three legal cooperative solutions, ownership, linked cells, consent and replay',()=>{
 const {games,room,act}=setup('lights');
 const before=structuredClone(room);assert.throws(()=>act(2,{kind:'toggle',index:0}),/队友/);assert.deepEqual(room,before);
 assert.throws(()=>act(1,{kind:'toggle',index:NaN}),/无效/);
 const cells=Array(9).fill(false);assert.deepEqual(toggleLights(cells,3,0),[true,true,false,true,false,false,false,false,false]);assert.deepEqual(toggleLights(toggleLights(cells,3,0),3,0),cells);
 act(1,{kind:'restart'});assert.equal(room.lights.round,0);act(2,{kind:'restart'});assert.equal(room.lights.round,1);
 for(let level=0;level<3;level++){
  for(const index of LIGHT_LEVELS[level].scramble)act(switchOwner(index,room.lights.size)+1,{kind:'toggle',index});
  assert.equal(room.lights.phase,'cleared');assert.ok(room.lights.cells.every(Boolean));
  if(level<2){act(1,{kind:'next'});assert.equal(room.lights.level,level);act(2,{kind:'next'});assert.equal(room.lights.level,level+1);}
 }
 assert.equal(room.status,'finished');assert.equal(room.reason,'lights-complete');games.rematch(1);games.rematch(2);assert.equal(room.lights.level,0);assert.equal(room.status,'playing');
});
test('gravity: four directions, turns, full columns, flip quota, stale and offline protection',()=>{
 for(const indexes of [[35,36,37,38],[0,7,14,21],[0,8,16,24],[21,15,9,3]]){const cells=Array(42).fill(0);indexes.forEach(i=>cells[i]=1);assert.equal(gravityLines(cells)[0].color,1);}
 const {games,room,act}=setup('gravity');assert.throws(()=>act(2,{kind:'drop',column:0}),/轮到/);
 assert.throws(()=>act(1,{kind:'drop',column:7}),/无效/);
 for(let i=0;i<6;i++)act(i%2+1,{kind:'drop',column:0});
 assert.throws(()=>act(1,{kind:'drop',column:0}),/已满/);
 act(1,{kind:'flip'});assert.equal(room.gravity.direction,'up');assert.deepEqual(room.gravity.flips,[0,1]);
 act(2,{kind:'flip'});assert.throws(()=>act(1,{kind:'flip'}),/用完/);
 assert.throws(()=>games.gravityAction(1,{kind:'drop',column:1,round:0,revision:0},[1,2]),/更新/);
 assert.throws(()=>games.gravityAction(1,{kind:'drop',column:1,round:0,revision:8},[1]),/上线/);
});
test('gravity: flip can give opponent victory or simultaneous draw, and normal victory resets',()=>{
 const {games,room,act}=setup('gravity');
 // Stable under downward gravity; flipping aligns the topmost blue tokens.
 for(let x=0;x<4;x++){const count=x+1;for(let y=6-count;y<6;y++)room.gravity.cells[y*7+x]=y===6-count?2:1;}
 act(1,{kind:'flip'});assert.equal(room.winner,2);assert.equal(room.status,'finished');
 games.rematch(1);games.rematch(2);assert.deepEqual(room.gravity.cells,Array(42).fill(0));
 for(let x=0;x<4;x++){room.gravity.cells[4*7+x]=1;room.gravity.cells[5*7+x]=2;}
 act(1,{kind:'flip'});assert.equal(room.winner,null);assert.equal(room.reason,'draw');
 games.rematch(1);games.rematch(2);
 for(let col=0;col<4;col++){act(1,{kind:'drop',column:col});if(col<3)act(2,{kind:'drop',column:6});}
 assert.equal(room.winner,1);assert.equal(room.status,'finished');
});
test('new games preserve concurrent old rooms and reject cross-game actions through every lifecycle',()=>{
 const games=new Games();const old=[];
 for(const [i,game,mode] of [[10,'gomoku','versus'],[12,'snake','versus'],[14,'snake','coop'],[16,'sokoban','coop']]){const r=games.create(user(i),{game,mode});games.join(user(i+1),r.id);old.push(r);}
 const saved=structuredClone(old);
 for(const [id,game,mode] of [[1,'lights','coop'],[3,'gravity','versus']]){
  const r=games.create(user(id),{game,mode});games.join(user(id+1),r.id);
  assert.throws(()=>games.move(id,0,0),/不是五子棋/);assert.throws(()=>games.readySnake(id,[id,id+1]),/不是贪食蛇/);assert.throws(()=>games.sokobanAction(id,{},[id,id+1]),/不是默契/);
  for(const oldRoom of old)assert.throws(()=>games[`${game}Action`](oldRoom.players[0].id,{},[]),/不是/);
  games[`${game}Action`](id,{kind:game==='lights'?'toggle':'drop',index:0,column:0,round:0,revision:0},[id,id+1]);
  const snap=structuredClone(r);assert.throws(()=>games[`${game}Action`](id,{kind:'invalid',round:0,revision:1},[id,id+1]));assert.deepEqual(r,snap);
  games.resign(id);games.rematch(id);games.rematch(id+1);games.leave(id);assert.deepEqual(old,saved);
 }
 games.move(10,0,0);assert.equal(old[0].board[0],1);
 games.readySnake(12,[12,13]);games.readySnake(13,[12,13]);games.advance(old[1].id,old[1].snake.nextTick,[12,13]);assert.equal(old[1].snake.ticks,1);
 games.sokobanAction(16,{kind:'move',direction:'up',round:0,revision:0},[16,17]);assert.equal(old[3].sokoban.moves,1);
});

test('every lights level needs switches from both players, not a solo solution',()=>{
 for(let level=0;level<LIGHT_LEVELS.length;level++){
  const s=newLights(level),target=s.cells.reduce((mask,on,i)=>on?mask:mask^(1<<i),0);
  for(const owner of [0,1]){
   const masks=s.cells.map((_,i)=>i).filter(i=>switchOwner(i,s.size)===owner).map(i=>toggleLights(Array(s.cells.length).fill(false),s.size,i).reduce((mask,on,j)=>on?mask^(1<<j):mask,0));
   for(let subset=0;subset<(1<<masks.length);subset++){
    let effect=0;for(let i=0;i<masks.length;i++)if(subset&(1<<i))effect^=masks[i];
    assert.notEqual(effect,target,`level ${level+1} must require both colors`);
   }
  }
 }
});
