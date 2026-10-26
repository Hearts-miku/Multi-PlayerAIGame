import { randomInt } from 'node:crypto';

const vectors = { up: [0,-1], down: [0,1], left: [-1,0], right: [1,0] };
export function newMaze(seed = randomInt(1, 0x100000000), round = 0, revision = 0) {
  let randomState = seed >>> 0;
  const random = (n) => { randomState = (Math.imul(randomState,1664525)+1013904223)>>>0; return Math.floor(randomState/0x100000000*n); };
  const size=9, cells=Array(size*size).fill(false), stack=[10]; cells[10]=true;
  while(stack.length) {
    const at=stack.at(-1),x=at%size,y=Math.floor(at/size);
    const next=Object.values(vectors).map(([dx,dy])=>[x+dx*2,y+dy*2]).filter(([nx,ny])=>nx>0&&ny>0&&nx<size-1&&ny<size-1&&!cells[ny*size+nx]);
    if(!next.length){stack.pop();continue;}
    const [nx,ny]=next[random(next.length)],to=ny*size+nx;
    cells[(at+to)/2]=true;cells[to]=true;stack.push(to);
  }
  const exit=40; // Connect the central meeting point to the existing maze.
  cells[exit]=true;cells[39]=true;cells[30]=true;
  const actors=[10,70], candidates=cells.flatMap((open,i)=>open&&!actors.includes(i)&&i!==exit?[i]:[]);
  const treasures=Array.from({length:4},(_,i)=>({at:candidates.splice(random(candidates.length),1)[0],owner:i%2,collected:false}));
  const state={seed,size,cells,actors,exit,treasures,seen:Array(size*size).fill(false),round,revision,moves:0,votes:{restart:[],reroll:[]}};
  reveal(state);return state;
}
function reveal(s) {
  for(const at of s.actors)for(let y=0;y<s.size;y++)for(let x=0;x<s.size;x++)
    if(Math.abs(x-at%s.size)+Math.abs(y-Math.floor(at/s.size))<=2)s.seen[y*s.size+x]=true;
}
export function freshMaze(previous) {
  let seed;do{seed=randomInt(1,0x100000000);}while(seed===previous.seed);
  return newMaze(seed,previous.round+1,previous.revision+1);
}
export function mazeAction(room,id,command,online) {
  const s=room.maze,player=room.players.findIndex(p=>p.id===id);
  if(player<0)throw new Error('你不在这个房间中');
  if(room.status!=='playing'||room.players.length!==2)throw new Error('等待双方加入后再操作');
  if(!room.players.every(p=>online.includes(p.id)))throw new Error('等待队友重新上线后继续');
  if(!command||command.round!==s.round||command.revision!==s.revision)throw new Error('地图已更新，请同步后重试');
  if(command.kind==='restart'||command.kind==='reroll') {
    const votes=s.votes[command.kind];
    if(!votes.includes(id)) {
      votes.push(id);s.revision++;
      if(votes.length===2)room.maze=command.kind==='restart'?newMaze(s.seed,s.round+1,s.revision):{...freshMaze(s),revision:s.revision};
    }
  } else {
    if(command.kind!=='move'||!Object.hasOwn(vectors,command.direction))throw new Error('无效的移动');
    const at=s.actors[player],[dx,dy]=vectors[command.direction],x=at%s.size+dx,y=Math.floor(at/s.size)+dy,to=y*s.size+x;
    if(x<0||y<0||x>=s.size||y>=s.size||!s.cells[to])throw new Error('前方是墙，请换个方向');
    s.actors[player]=to;s.moves++;s.revision++;s.votes={restart:[],reroll:[]};
    for(const treasure of s.treasures)if(treasure.at===to&&treasure.owner===player)treasure.collected=true;
    reveal(s);
    if(s.treasures.every(t=>t.collected)&&s.actors.every(at=>at===s.exit)){room.status='finished';room.winner=null;room.reason='maze-complete';}
  }
  room.updatedAt=Date.now();return room;
}
