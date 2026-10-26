import React from 'react';
import GameCardSelect from './GameCardSelect.jsx';
import DuoPanel from './DuoPanel.jsx';
import { LIGHT_LEVELS, switchOwner } from '../shared/lights.js';
import './lights.css';
export function LightsCard({selected,disabled,onSelect}) {
  return <section className={`lights-card selectable-game ${selected?'selected-game':''}`}><GameCardSelect name="星灯维修站" selected={selected} disabled={disabled} onSelect={onSelect}/><div><span className="tag">合作解谜 · 2 人点亮</span><h2>星灯维修站</h2><p>你管橙色，我管蓝色。<br/>一枚开关，牵动一片星光。</p><small>{LIGHT_LEVELS.length} 关递进 · 相邻联动 · 不计时</small></div><div className="lights-card-art" aria-hidden="true">{Array.from({length:9},(_,i)=><span key={i} style={{opacity:i%3===0?.3:1}}>✦</span>)}</div></section>;
}
export default function LightsMatch(props) {
  const {room,user,connected,pending,action,invite}=props,s=room.lights,index=room.players.findIndex(p=>p.id===user.id);
  const online=room.players.length===2&&room.players.every(p=>p.online),available=connected&&!pending&&online&&room.status==='playing';
  const send=(kind,cell)=>action('lights:action',{kind,index:cell,round:s.round,revision:s.revision});
  const title=room.status==='waiting'?'等队友，一起点亮':room.status==='finished'?(room.reason==='lights-complete'?'整片星空，因你们亮起！':'本次挑战已结束'):!online?'等队友回来继续':s.phase==='cleared'?'本关点亮！':s.name;
  return <div className="play-layout lights-layout"><section className="table-panel"><div className="table-heading"><span><b>星灯维修站</b><small>第 {s.level+1} / {s.totalLevels??3} 关</small></span><button className="text-button" onClick={invite}>复制邀请 ↗</button></div>
    <p className="lights-summary">已点亮 {s.cells.filter(Boolean).length} / {s.cells.length} · 合作操作 {s.moves} 次</p>
    <div className="lights-board" data-testid="lights-board" data-level={s.level} data-revision={s.revision} data-phase={s.phase} style={{gridTemplateColumns:`repeat(${s.size},1fr)`}}>{s.cells.map((on,i)=><button key={i} data-testid={`light-${i}`} data-lit={on} className={`lights-cell lights-owner-${switchOwner(i,s.size)} ${on?'lights-on':''}`} aria-label={`开关 ${i+1} · ${switchOwner(i,s.size)===0?'橙色':'蓝色'} · ${on?'亮':'暗'}`} disabled={!available||s.phase!=='active'||switchOwner(i,s.size)!==index} onClick={()=>send('toggle',i)}><span>{on?'✦':'·'}</span><small>{switchOwner(i,s.size)+1}</small></button>)}</div>
    <p className="lights-help">你负责{index===0?'橙色 1 号':'蓝色 2 号'}开关。点击后，它和上下左右的灯都会翻转；目标是让所有灯同时亮起。</p>
  </section><DuoPanel {...props} title={title} cooperative>
    {room.status==='playing'&&<div className="lights-actions">{s.phase==='cleared'&&<button className="primary full" disabled={!available||s.votes.next.includes(user.id)} onClick={()=>send('next')}>{s.votes.next.includes(user.id)?'已准备，等队友…':s.votes.next.length?'一起进入下一关':'准备下一关'}</button>}<button className="secondary full" disabled={!available||s.votes.restart.includes(user.id)} onClick={()=>send('restart')}>{s.votes.restart.includes(user.id)?'已申请，等队友…':s.votes.restart.length?'同意重开本关':'申请重开本关'}</button></div>}
    <div className="rules"><h4>合作秘诀</h4><p>亮灯也可以再按。先说好谁动哪个开关，避免反复抵消。再次按同一开关可以还原它的影响。</p><p>双方确认才能重开或换关；继续按开关会取消待确认请求。队友离线暂停，回来后保留进度。</p></div>
  </DuoPanel></div>;
}
