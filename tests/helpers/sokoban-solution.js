import { Games } from '../../server/game.js';
import { gateOpen, nextLatches } from '../../shared/sokoban-mechanics.js';

// A legal walkthrough generated through the same public game operations as players.
// No board mutation, teleports or skipped levels: these moves also drive browser tests.
export function campaignSolution() {
  const games = new Games();
  const room = games.create({id:1,displayName:'orange'},{game:'sokoban',mode:'coop'});
  games.join({id:2,displayName:'blue'},room.id);
  const steps=[];
  const act=(player,kind,direction)=>{
    games.sokobanAction(player,{kind,direction,round:room.sokoban.round,revision:room.sokoban.revision},[1,2]);
    const s=room.sokoban;
    steps.push({player,kind,direction,level:s.level,moves:s.moves,revision:s.revision,phase:s.phase,latches:[...s.latches],gates:s.gates.map(p=>({at:p,open:gateOpen(s,p)})),status:room.status});
  };
  const walk=(player,x,y)=>{
    const s=room.sokoban,queue=[[s.actors[player-1],[],s.latches]],seen=new Set();
    while(queue.length){
      const [[a,b],path,latches]=queue.shift();
      const current={...s,actors:s.actors.map((p,i)=>i===player-1?[a,b]:p),latches};
      if(a===x&&b===y){for(const d of path)act(player,'move',d);return;}
      const key=`${a},${b}:${latches.join()}`;if(seen.has(key))continue;seen.add(key);
      for(const [d,dx,dy] of [['up',0,-1],['down',0,1],['left',-1,0],['right',1,0]]){
        const nx=a+dx,ny=b+dy;if(nx<0||ny<0||nx>=s.width||ny>=s.height)continue;
        if([...s.walls,...s.boxes,s.actors[2-player],...s.gates.filter(p=>!gateOpen(current,p))].some(([px,py])=>px===nx&&py===ny))continue;
        const candidate={...current,actors:current.actors.map((p,i)=>i===player-1?[nx,ny]:p)};candidate.latches=nextLatches(candidate);
        if(s.gates.some(p=>gateOpen(current,p)&&!gateOpen(candidate,p)&&[...candidate.actors,...s.boxes].some(q=>q[0]===p[0]&&q[1]===p[1])))continue;
        queue.push([[nx,ny],[...path,d],candidate.latches]);
      }
    }
    throw new Error(`Level ${s.level+1}: no path for ${player} to ${x},${y}`);
  };
  const push=(p,d,n=1)=>{for(let i=0;i<n;i++)act(p,'move',d);};
  const next=()=>{if(room.sokoban.phase!=='cleared')throw new Error(`Unsolved level ${room.sokoban.level+1}`);act(1,'next');act(2,'next');};
  push(1,'up',2);push(2,'up',2);next();
  push(2,'right');push(1,'right',4);walk(1,7,3);push(1,'left');walk(1,5,4);push(1,'up');
  walk(1,3,1);push(2,'left');walk(1,2,1);walk(2,6,5);push(2,'up');walk(2,7,3);push(2,'left',4);next();
  push(2,'right');push(1,'right',4);walk(1,7,5);push(1,'up');walk(1,6,3);push(1,'right');
  walk(1,2,3);push(2,'left');walk(1,2,2);walk(2,9,4);push(2,'left',6);walk(2,2,3);push(2,'down');next();
  // Separate circuits: one player must hold each colored plate for the other.
  push(2,'right');push(1,'right',5);walk(1,8,3);walk(2,8,4);push(2,'down');walk(2,9,6);push(2,'left',6);next();
  // Leave orange's crate on the pressure plate until blue is safely home.
  push(1,'up');walk(1,3,2);walk(2,9,4);push(2,'left',6);walk(2,2,3);push(2,'down');walk(1,1,2);push(1,'right');next();
  // Both players meet the latch condition; afterwards they may leave the pads.
  walk(1,2,2);walk(2,3,6);walk(1,3,2);push(1,'down');walk(1,2,4);push(1,'right',4);
  walk(1,7,5);push(1,'up');walk(1,6,3);push(1,'right');walk(2,9,4);push(2,'left',6);walk(2,2,3);push(2,'down');next();
  // Two crates open the outbound route, then both players unlock the return route.
  push(1,'up');push(2,'up');walk(1,7,2);walk(2,8,6);walk(2,7,5);
  walk(1,2,1);push(1,'down',4);walk(1,1,6);push(1,'right',6);walk(1,8,7);push(1,'up',3);
  walk(2,3,1);push(2,'down',4);walk(2,2,6);push(2,'right',5);walk(2,8,7);push(2,'up');next();
  // Three rooms, two temporary circuits and a shared permanent return route.
  push(1,'up');walk(2,7,4);push(2,'up');walk(1,11,2);walk(2,12,6);walk(2,11,5);
  walk(1,2,1);push(1,'down',4);walk(1,1,6);push(1,'right',10);walk(1,12,7);push(1,'up',3);
  walk(2,7,1);push(2,'down',4);walk(2,6,6);push(2,'right',5);walk(2,12,7);push(2,'up');
  if(room.status!=='finished')throw new Error('Campaign did not finish');
  return {steps,room};
}
