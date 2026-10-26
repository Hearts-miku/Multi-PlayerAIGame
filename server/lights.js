import { LIGHT_LEVELS, switchOwner, toggleLights } from '../shared/lights.js';
export function newLights(level=0, round=0, revision=0) {
  const {size,name,scramble}=LIGHT_LEVELS[level];
  let cells=Array(size*size).fill(true);
  for(const index of scramble)cells=toggleLights(cells,size,index);
  return {level,size,name,cells,round,revision,moves:0,phase:'active',votes:{restart:[],next:[]}};
}
export function lightsAction(room,id,command,online) {
  const s=room.lights, player=room.players.findIndex(p=>p.id===id);
  if(player<0)throw new Error('你不在这个房间中');
  if(room.status!=='playing'||room.players.length!==2)throw new Error('等待双方加入后再操作');
  if(!room.players.every(p=>online.includes(p.id)))throw new Error('等待队友重新上线后继续');
  if(!command||command.round!==s.round)throw new Error('关卡已更新，请同步后重试');
  if(command.kind==='restart'||command.kind==='next') {
    const kind=command.kind;
    if(kind==='next'&&(s.phase!=='cleared'||s.level+1>=LIGHT_LEVELS.length))throw new Error('当前不能进入下一关');
    if(!s.votes[kind].includes(id)) {
      s.votes[kind].push(id);s.revision++;
      if(s.votes[kind].length===2)room.lights=newLights(s.level+(kind==='next'?1:0),s.round+1,s.revision);
    }
  } else {
    if(command.kind!=='toggle'||s.phase!=='active')throw new Error('当前不能操作开关');
    if(command.revision!==s.revision)throw new Error('队友刚操作过，请同步后重试');
    const index=command.index;
    if(!Number.isInteger(index)||index<0||index>=s.cells.length)throw new Error('无效的开关');
    if(switchOwner(index,s.size)!==player)throw new Error('这个开关由队友负责');
    s.cells=toggleLights(s.cells,s.size,index);s.moves++;s.revision++;s.votes={restart:[],next:[]};
    if(s.cells.every(Boolean)) {
      s.phase='cleared';
      if(s.level===LIGHT_LEVELS.length-1){room.status='finished';room.reason='lights-complete';room.winner=null;}
    }
  }
  room.updatedAt=Date.now();return room;
}
