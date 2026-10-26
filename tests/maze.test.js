import test from 'node:test';
import assert from 'node:assert/strict';
import { Games } from '../server/game.js';
import { newMaze } from '../server/maze.js';
import { mazePath } from './helpers/maze-path.js';
const user=id=>({id,displayName:`p${id}`});
function setup(){const games=new Games(),room=games.create(user(1),{game:'maze',mode:'coop'});games.join(user(2),room.id);const act=(id,c)=>games.mazeAction(id,{round:room.maze.round,revision:room.maze.revision,...c},[1,2]);return{games,room,act};}
test('maze: 1000 deterministic seeds are connected, distinct and solvable by both owners',()=>{
 const layouts=new Set();
 for(let seed=1;seed<=1000;seed++){
  const {room,act}=setup();room.maze=newMaze(seed);const s=room.maze;
  assert.deepEqual(newMaze(seed),s);assert.equal(new Set(s.treasures.map(t=>t.at)).size,4);
  assert.equal(s.treasures.filter(t=>t.owner===0).length,2);assert.equal(s.treasures.filter(t=>t.owner===1).length,2);
  const landmarks=[...s.treasures.map(t=>t.at),...s.adventure.portals,...s.adventure.beacons,...s.adventure.sparks.map(t=>t.at),...s.actors,s.exit];
  assert.equal(new Set(landmarks).size,landmarks.length);assert.ok(landmarks.every(at=>s.cells[at]));
  for(let at=0;at<s.cells.length;at++)if(s.cells[at])mazePath(s,s.actors[0],at);
  layouts.add(JSON.stringify([s.cells,s.treasures]));
  for(let player=0;player<2;player++)for(const to of [...s.treasures.filter(t=>t.owner===player).map(t=>t.at),s.exit])
    for(const direction of mazePath(s,s.actors[player],to)){if(room.status==='finished')break;act(player+1,{kind:'move',direction});}
  assert.equal(room.status,'finished');assert.equal(room.reason,'maze-complete');assert.ok(s.treasures.every(t=>t.collected));assert.ok(s.actors.every(at=>at===s.exit));
 }
 assert.equal(layouts.size,1000);
});
test('maze: wall, ownership, membership, stale moves and offline protections are atomic',()=>{
 const {games,room,act}=setup(),before=structuredClone(room);
 for(const command of [{kind:'teleport'},{kind:'move',direction:'up'},{kind:'move',direction:'bad'},{kind:'bad'},{kind:'move',direction:'right',revision:-1},{kind:'move',direction:'right',round:-1}]){assert.throws(()=>act(1,command));assert.deepEqual(room,before);}
 assert.throws(()=>games.mazeAction(99,{},[1,2]),/尚未/);
 assert.throws(()=>games.mazeAction(1,{round:0,revision:0,kind:'restart'},[1]),/上线/);assert.deepEqual(room,before);
 const s=room.maze,other=s.treasures.find(t=>t.owner===1);
 for(const direction of mazePath(s,s.actors[0],other.at))act(1,{kind:'move',direction});
 assert.equal(other.collected,false);assert.equal(room.status,'playing');assert.equal(s.seen[other.at],true);
});

test('maze: 100 seeds support portals, simultaneous beacons, unique spark rewards and three-star wins',()=>{
 for(let seed=1;seed<=100;seed++){
  const {room,act}=setup();room.maze=newMaze(seed);const s=room.maze,a=s.adventure;
  const walk=(player,to)=>{for(const direction of mazePath(s,s.actors[player],to)){if(room.status==='finished')break;act(player+1,{kind:'move',direction});}};
  walk(0,a.portals[0]);const moves=s.moves,revision=s.revision;
  act(1,{kind:'restart'});act(1,{kind:'teleport'});assert.equal(s.actors[0],a.portals[1]);assert.equal(s.moves,moves+1);assert.equal(s.revision,revision+2);assert.equal(a.teleports,1);assert.deepEqual(s.votes,{restart:[],reroll:[]});assert.equal(s.seen[a.portals[1]],true);
  act(1,{kind:'teleport'});assert.equal(s.actors[0],a.portals[0]);assert.equal(a.teleports,2);
  walk(0,a.beacons[0]);assert.equal(a.lit,false);walk(1,a.beacons[1]);assert.equal(a.lit,true);assert.ok(s.seen.every(Boolean));
  for(const spark of a.sparks)walk(0,spark.at);assert.ok(a.sparks.every(t=>t.collected));
  const collected=structuredClone(a.sparks);walk(0,a.sparks[0].at);assert.deepEqual(a.sparks,collected);
  for(let player=0;player<2;player++)for(const to of [...s.treasures.filter(t=>t.owner===player).map(t=>t.at),s.exit])walk(player,to);
  assert.equal(room.status,'finished');assert.equal(a.stars,3);
 }
});

test('maze: same-map restart resets adventure rewards; legacy rooms remain playable until rematch',()=>{
 const {games,room,act}=setup(),initial=structuredClone(room.maze);
 for(const direction of mazePath(room.maze,room.maze.actors[0],room.maze.adventure.sparks[0].at))act(1,{kind:'move',direction});
 assert.ok(room.maze.adventure.sparks.some(t=>t.collected));act(1,{kind:'restart'});act(2,{kind:'restart'});assert.deepEqual(room.maze.adventure,initial.adventure);
 room.maze=newMaze(79,0,0,false);const legacy=structuredClone(room.maze);
 assert.throws(()=>act(1,{kind:'teleport'}),/传送门/);assert.deepEqual(room.maze,legacy);
 act(1,{kind:'restart'});act(2,{kind:'restart'});assert.equal(room.maze.adventure,undefined);assert.deepEqual(room.maze.treasures,legacy.treasures);
 const s=room.maze;for(let player=0;player<2;player++)for(const to of [...s.treasures.filter(t=>t.owner===player).map(t=>t.at),s.exit])for(const direction of mazePath(s,s.actors[player],to)){if(room.status==='finished')break;act(player+1,{kind:'move',direction});}
 assert.equal(room.status,'finished');games.rematch(1);games.rematch(2);assert.ok(room.maze.adventure);assert.equal(room.maze.adventure.stars,0);
});
test('maze: consent, same-map restart, fresh-map reroll, replay and all existing games stay isolated',()=>{
 const {games,room,act}=setup(),old=[];
 for(const [i,game,mode] of [[10,'gomoku','versus'],[12,'snake','versus'],[14,'snake','coop'],[16,'sokoban','coop'],[18,'lights','coop'],[20,'gravity','versus']]){
  const r=games.create(user(i),{game,mode});games.join(user(i+1),r.id);old.push(r);assert.throws(()=>games.mazeAction(i,{},[i,i+1]),/不是/);
 }
 const saved=structuredClone(old),initial=structuredClone(room.maze);
 for(const method of ['lightsAction','gravityAction','sokobanAction'])assert.throws(()=>games[method](1,{},[1,2]),/不是/);
 assert.throws(()=>games.move(1,0,0),/不是/);assert.throws(()=>games.readySnake(1,[1,2]),/不是/);
 act(1,{kind:'restart'});const revision=room.maze.revision;act(1,{kind:'restart'});assert.equal(room.maze.revision,revision);
 const direction=mazePath(room.maze,room.maze.actors[0],room.maze.exit)[0];act(1,{kind:'move',direction});assert.deepEqual(room.maze.votes,{restart:[],reroll:[]});
 act(1,{kind:'restart'});act(2,{kind:'restart'});assert.deepEqual(room.maze.cells,initial.cells);assert.deepEqual(room.maze.treasures,initial.treasures);assert.deepEqual(room.maze.actors,initial.actors);assert.equal(room.maze.seed,initial.seed);
 act(1,{kind:'reroll'});assert.equal(room.maze.seed,initial.seed);act(2,{kind:'reroll'});assert.notEqual(room.maze.seed,initial.seed);
 const seed=room.maze.seed;games.resign(1);games.rematch(1);assert.equal(room.maze.seed,seed);games.rematch(2);assert.notEqual(room.maze.seed,seed);
 games.leave(1);assert.deepEqual(old,saved);games.move(10,0,0);assert.equal(old[0].board[0],1);
});
