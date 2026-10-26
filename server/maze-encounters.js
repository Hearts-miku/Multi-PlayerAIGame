import { MAZE_ENCOUNTERS } from '../shared/maze-encounters.js';

export function newEncounters(s, candidates, random) {
  const kinds=Object.keys(MAZE_ENCOUNTERS);
  for(let i=kinds.length-1;i>0;i--){const j=random(i+1);[kinds[i],kinds[j]]=[kinds[j],kinds[i]];}
  const walls=s.cells.flatMap((open,at)=>{
    const x=at%s.size,y=Math.floor(at/s.size);
    return !open&&x>0&&y>0&&x<s.size-1&&y<s.size-1&&((s.cells[at-1]&&s.cells[at+1])||(s.cells[at-s.size]&&s.cells[at+s.size]))?[at]:[];
  });
  return {spots:kinds.map(kind=>({kind,at:candidates.splice(random(candidates.length),1)[0],used:false})),passage:walls.length?walls[random(walls.length)]:null,picnic:null,badges:0,history:[]};
}
function light(s,at,radius){for(let i=0;i<s.cells.length;i++)if(Math.abs(i%s.size-at%s.size)+Math.abs(Math.floor(i/s.size)-Math.floor(at/s.size))<=radius)s.seen[i]=true;}
function record(s,title,message){const e=s.encounters;e.history.push({move:s.moves,title,message});s.adventure.event=message;}
export function encounterStep(s,player) {
  const e=s.encounters;if(!e)return;
  const spot=e.spots.find(t=>t.at===s.actors[player]&&!t.used);
  if(spot){
    spot.used=true;const title=MAZE_ENCOUNTERS[spot.kind].name;let message;
    if(spot.kind==='fireflies'){for(const at of s.actors)light(s,at,3);message='萤火虫围着你们起舞，两人的视野都扩大了！';}
    if(spot.kind==='compass'){for(const t of s.treasures)if(!t.collected)light(s,t.at,1);light(s,s.exit,1);message='罗盘标出了未找到的宝石和出口，和队友商量路线吧！';}
    if(spot.kind==='meteor'){const spark=s.adventure.sparks.find(t=>!t.collected);if(spark){spark.collected=true;light(s,spark.at,1);message='流星送来一颗幸运星，已计入三星挑战！';}else{e.badges++;message='幸运星已经集齐，流星送给你们一枚纪念章！';}}
    if(spot.kind==='passage'){if(e.passage!==null){s.cells[e.passage]=true;light(s,e.passage,2);message='藤蔓后的秘密通道打开了，试试这条新捷径！';}else{e.badges++;message='通道精灵送来一枚纪念章，祝你们一路顺风！';}}
    if(spot.kind==='picnic'){e.picnic={at:spot.at,done:false};message=`${player+1}号发现野餐篮！邀请队友来 ♧ 会合，领取合作奖励。`;}
    record(s,title,message);
  }
  if(e.picnic&&!e.picnic.done&&s.actors.every(at=>at===e.picnic.at)){
    e.picnic.done=true;e.badges++;light(s,e.picnic.at,4);record(s,'野餐成功','两人碰杯，野餐成功！获得一枚纪念章，周围的迷雾也散开了。');
  }
}
