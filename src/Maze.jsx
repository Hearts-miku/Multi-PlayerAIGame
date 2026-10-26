import React, { useEffect, useRef } from 'react';
import GameCardSelect from './GameCardSelect.jsx';
import DuoPanel from './DuoPanel.jsx';
import './maze.css';
import { MAZE_ENCOUNTERS } from '../shared/maze-encounters.js';
const controls=[['up','↑','向上'],['left','←','向左'],['down','↓','向下'],['right','→','向右']];
const keys={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right',w:'up',s:'down',a:'left',d:'right'};
export function MazeCard({selected,disabled,onSelect}) {
  return <section className={`maze-card selectable-game ${selected?'selected-game':''}`}><GameCardSelect name="迷雾寻宝" selected={selected} disabled={disabled} onSelect={onSelect}/><div><span className="tag">随机迷宫 · 双人合作</span><h2>迷雾寻宝</h2><p>穿过传送门，一起点亮灯塔。<br/>寻宝、摘星，挑战你们的三星探险！</p><small>每局随机 · 共享探索 · 不计时</small></div><div className="maze-art" aria-hidden="true">✧<span>╔═╗<br/>╚╗╚═╗<br/> ╚══╝</span>✧</div></section>;
}
export default function MazeMatch(props) {
  const {room,user,connected,pending,action}=props,s=room.maze,index=room.players.findIndex(p=>p.id===user.id);
  const available=connected&&!pending&&room.status==='playing'&&room.players.length===2&&room.players.every(p=>p.online);
  const adventure=s.adventure,portal=adventure?.portals.includes(s.actors[index]);
  const send=(kind,direction)=>action('maze:action',{kind,direction,round:s.round,revision:s.revision});
  const handler=useRef();handler.current=direction=>{if(available)send('move',direction);};
  useEffect(()=>{const keydown=e=>{if(e.target instanceof HTMLElement&&(e.target.matches('input,textarea,select')||e.target.isContentEditable))return;const direction=keys[e.key]||keys[e.key.toLowerCase()];if(direction){e.preventDefault();if(!e.repeat)handler.current(direction);}};window.addEventListener('keydown',keydown);return()=>window.removeEventListener('keydown',keydown);},[]);
  const title=room.status==='waiting'?'等队友，一起探险':room.status==='finished'?(room.reason==='maze-complete'?'宝物到手，一起回家！':'本次探险已结束'):room.players.some(p=>!p.online)?'等队友回来继续':'收齐宝石，在出口会合';
  return <div className="play-layout maze-layout"><section className="table-panel"><div className="table-heading"><span><b>迷雾寻宝</b><small>随机地图 · {s.seed.toString(16).toUpperCase()}</small></span></div>
    <p className="maze-summary">宝石 {s.treasures.filter(t=>t.collected).length} / 4 · 合作行动 {s.moves} 次{adventure&&` · 幸运星 ${adventure.sparks.filter(t=>t.collected).length} / 3`}{s.encounters&&` · 纪念章 ${s.encounters.badges}`}</p>
    {adventure&&<p className="maze-event" role="status" aria-live="polite">{adventure.event}</p>}
    <div className="maze-board" role="img" aria-label="共享探索的九行九列迷宫" data-testid="maze-board" data-revision={s.revision} data-round={s.round} data-seed={s.seed}>
      {s.cells.map((open,at)=>{const seen=s.seen[at],treasure=s.treasures.find(t=>t.at===at&&!t.collected),players=s.actors.flatMap((p,i)=>p===at?[i]:[]);return <div key={at} data-testid={`maze-cell-${at}`} data-seen={seen} className={`maze-cell ${seen?(open?'maze-path':'maze-wall'):'maze-fog'}`}>
        {seen&&at===s.exit&&<span className="maze-exit" title="会合出口">⌂</span>}{seen&&treasure&&<span className={`maze-owner-${treasure.owner}`} title={`${treasure.owner+1}号宝石`}>◆</span>}
        {seen&&adventure?.portals.includes(at)&&<span className="maze-portal" title="传送门：站上后点击使用" data-testid={`maze-portal-${at}`}>◎</span>}
        {seen&&adventure?.beacons.includes(at)&&<span className={`maze-beacon ${adventure.lit?'maze-beacon-lit':''}`} title={`双人灯塔 ${adventure.beacons.indexOf(at)+1}`} data-testid={`maze-beacon-${at}`} data-lit={adventure.lit}>♜</span>}
        {seen&&adventure?.sparks.some(t=>t.at===at&&!t.collected)&&<span className="maze-spark" title="幸运星，任意队友可收集">★</span>}
        {seen&&s.encounters?.spots.filter(t=>t.at===at).map(t=><span key={t.at} className={`maze-surprise ${t.used?'maze-surprise-used':''}`} data-testid={`maze-encounter-${at}`} data-used={t.used} title={t.used?MAZE_ENCOUNTERS[t.kind].name:'神秘遭遇：走上去看看'}>{t.used?MAZE_ENCOUNTERS[t.kind].icon:'?'}</span>)}
        {players.map(i=><b key={i} className={`maze-player maze-owner-${i}`} data-testid={`maze-player-${i}`} data-position={at}>{i+1}</b>)}
      </div>;})}
    </div><p className="maze-help">你是{index+1}号探险家，收集{index===0?'橙色':'蓝色'}宝石。探索范围永久共享，找齐四颗后，两人都走到 ⌂ 出口。可以站在同一格。</p>
    <div className="maze-controls" role="group" aria-label="迷雾寻宝方向控制">{controls.map(([direction,arrow,label])=><button key={direction} aria-label={label} disabled={!available} onClick={()=>send('move',direction)}>{arrow}</button>)}</div><p className="maze-help">方向键 / WASD / 下方按钮移动</p>
    {adventure&&<><button className="secondary full maze-teleport" disabled={!available||!portal} onClick={()=>send('teleport')}>使用传送门</button><p className="maze-legend">◎ 传送门 · ♜ 双人灯塔 · ★ 幸运星 · ◆ 宝石 · ⌂ 出口</p></>}
    </section><DuoPanel {...props} title={title} cooperative><div className="maze-inventory">{[0,1].map(i=><p key={i} className={`maze-owner-${i}`}>{i+1}号宝石：{s.treasures.filter(t=>t.owner===i&&t.collected).length} / 2</p>)}</div>
    {adventure&&<section className="maze-challenges" aria-label="探险挑战"><h3>一起争取三星</h3><p>★ 收齐宝石并一起到出口</p><p data-testid="maze-beacon-goal" data-complete={adventure.lit}>{adventure.lit?'✓':'☆'} 两人分别站上两个灯塔，照亮全图</p><p data-testid="maze-spark-goal" data-count={adventure.sparks.filter(t=>t.collected).length}>{adventure.sparks.every(t=>t.collected)?'✓':'☆'} 集齐三颗幸运星</p>{room.reason==='maze-complete'&&<div className="maze-rating" data-testid="maze-rating" data-stars={adventure.stars} aria-label={`${adventure.stars}星通关`}>{'★'.repeat(adventure.stars)}{'☆'.repeat(3-adventure.stars)}<small>{adventure.stars===3?'黄金探险搭档！':'下次一起挑战满星吧！'}</small></div>}</section>}
    {s.encounters&&<section className="maze-challenges maze-encounters" aria-label="随机奇遇"><h3>随机奇遇 <small data-testid="maze-encounter-count">{s.encounters.spots.filter(t=>t.used).length} / 5</small></h3><p>走到 ? 格触发一次惊喜；重走原图可以重新体验。</p>{s.encounters.picnic&&<p data-testid="maze-picnic" data-complete={s.encounters.picnic.done}>{s.encounters.picnic.done?'✓ 野餐成功':'♧ 野餐篮已打开，等两人同时到这里会合！'}</p>}<p data-testid="maze-badges" data-count={s.encounters.badges}>探险纪念章：{s.encounters.badges}（不影响星级）</p><ol>{s.encounters.history.slice(-3).map((event,i)=><li key={`${event.move}-${i}`}><strong>{event.title}</strong><span>{event.message}</span></li>)}</ol><details><summary>可能遇到什么？</summary>{Object.values(MAZE_ENCOUNTERS).map(event=><p key={event.name}><b>{event.icon} {event.name}</b><br/>{event.detail}</p>)}</details></section>}
    {room.status==='playing'&&<div className="maze-actions">{[['restart','重走这张地图'],['reroll','换张随机地图']].map(([kind,label])=><button key={kind} className="secondary full" disabled={!available||s.votes[kind].includes(user.id)} onClick={()=>send(kind)}>{s.votes[kind].includes(user.id)?'已申请，等队友…':s.votes[kind].length?`同意${label}`:label}</button>)}</div>}
    <div className="rules"><h4>探险约定</h4><p>只有本人能收集自己颜色的宝石。走过的区域会留在共同地图上，和队友交流路线吧。</p>{adventure&&<p>站在 ◎ 上可主动传送到另一扇门；两人同时占住不同的 ♜，灯塔就永久点亮。幸运星和灯塔是额外挑战，不影响普通通关。</p>}<p>重走保留地图，换图和再战生成新地图；重走、换图均需双方同意。行动会取消待确认请求。队友断线时暂停操作。</p></div></DuoPanel></div>;
}
