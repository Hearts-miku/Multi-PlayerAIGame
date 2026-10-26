export const WIDTH=7, HEIGHT=6;
export function newGravity(round=0,revision=0){return {cells:Array(WIDTH*HEIGHT).fill(0),direction:'down',turn:0,flips:[1,1],moves:0,round,revision,winning:[]};}
export function gravityLines(cells){
  const lines=[];
  for(let y=0;y<HEIGHT;y++)for(let x=0;x<WIDTH;x++)for(const [dx,dy] of [[1,0],[0,1],[1,1],[1,-1]]){
    const positions=Array.from({length:4},(_,i)=>[x+i*dx,y+i*dy]);
    if(positions.some(([a,b])=>a<0||a>=WIDTH||b<0||b>=HEIGHT))continue;
    const indexes=positions.map(([a,b])=>b*WIDTH+a),color=cells[indexes[0]];
    if(color&&indexes.every(i=>cells[i]===color))lines.push({color,indexes});
  }
  return lines;
}
export function gravityAction(room,id,command,online){
  const s=room.gravity, player=room.players.findIndex(p=>p.id===id);
  if(player<0)throw new Error('你不在这个房间中');
  if(room.status!=='playing'||room.players.length!==2)throw new Error('等待双方加入后再操作');
  if(!room.players.every(p=>online.includes(p.id)))throw new Error('等待对手重新上线后继续');
  if(!command||command.round!==s.round||command.revision!==s.revision)throw new Error('棋盘已更新，请同步后重试');
  if(s.turn!==player)throw new Error('还没轮到你');
  if(command.kind==='drop'){
    const col=command.column;
    if(!Number.isInteger(col)||col<0||col>=WIDTH)throw new Error('无效的列');
    const rows=Array.from({length:HEIGHT},(_,i)=>s.direction==='down'?HEIGHT-1-i:i);
    const row=rows.find(y=>s.cells[y*WIDTH+col]===0);
    if(row===undefined)throw new Error('这一列已满');
    s.cells[row*WIDTH+col]=room.players[player].color;
  } else if(command.kind==='flip') {
    if(!s.flips[player])throw new Error('你的重力翻转机会已用完');
    s.flips[player]--;s.direction=s.direction==='down'?'up':'down';
    for(let x=0;x<WIDTH;x++){
      const tokens=Array.from({length:HEIGHT},(_,y)=>s.cells[y*WIDTH+x]).filter(Boolean);
      for(let y=0;y<HEIGHT;y++)s.cells[y*WIDTH+x]=0;
      const offset=s.direction==='down'?HEIGHT-tokens.length:0;
      tokens.forEach((color,i)=>{s.cells[(offset+i)*WIDTH+x]=color;});
    }
  } else throw new Error('无效的操作');
  s.moves++;s.revision++;s.turn=1-player;
  const lines=gravityLines(s.cells),colors=[...new Set(lines.map(l=>l.color))];s.winning=lines.flatMap(l=>l.indexes);
  if(colors.length||s.cells.every(Boolean)){
    room.status='finished';room.winner=colors.length===1?colors[0]:null;room.reason=colors.length===1?'gravity-four':'draw';
  }
  room.updatedAt=Date.now();return room;
}
