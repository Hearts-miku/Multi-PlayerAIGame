// Independent BFS oracle for generated maps and ordinary button-driven solutions.
export function mazePath(s,from,to) {
  const queue=[[from,[]]],seen=new Set([from]);
  for(let q=0;q<queue.length;q++) {
    const [at,path]=queue[q];if(at===to)return path;
    for(const [direction,dx,dy] of [['up',0,-1],['down',0,1],['left',-1,0],['right',1,0]]){
      const x=at%s.size+dx,y=Math.floor(at/s.size)+dy,next=y*s.size+x;
      if(x>=0&&y>=0&&x<s.size&&y<s.size&&s.cells[next]&&!seen.has(next)){seen.add(next);queue.push([next,[...path,direction]]);}
    }
  }
  throw new Error(`No path from ${from} to ${to}`);
}
