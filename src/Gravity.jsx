import React from 'react';
import GameCardSelect from './GameCardSelect.jsx';
import DuoPanel from './DuoPanel.jsx';
import './gravity.css';
export function GravityCard({selected,disabled,onSelect}) {
  return <section className={`gravity-card selectable-game ${selected?'selected-game':''}`}><GameCardSelect name="引力四连" selected={selected} disabled={disabled} onSelect={onSelect}/><div><span className="tag">策略对战 · 2 人博弈</span><h2>引力四连</h2><p>连成四颗星，还是颠倒整片天空？<br/>把唯一一次翻转，留给关键时刻。</p><small>轮流落子 · 每人一次重力反转</small></div><div className="gravity-card-art" aria-hidden="true"><span>↑</span><b>● ● ●</b><span>↓</span></div></section>;
}
export default function GravityMatch(props) {
  const {room,user,connected,pending,action,invite}=props,s=room.gravity,index=room.players.findIndex(p=>p.id===user.id);
  const online=room.players.length===2&&room.players.every(p=>p.online),available=connected&&!pending&&online&&room.status==='playing'&&s.turn===index;
  const send=(kind,column)=>action('gravity:action',{kind,column,round:s.round,revision:s.revision});
  const winner=room.players.find(p=>p.color===room.winner);
  const title=room.status==='waiting'?'等对手，准备改变引力':room.status==='finished'?(winner?`${winner.displayName} 获胜`:'双方平局'):!online?'等对手回来继续':s.turn===index?'轮到你，选择一列':'等待对手落子';
  return <div className="play-layout gravity-layout"><section className="table-panel"><div className="table-heading"><span><b>引力四连</b><small>重力{ s.direction==='down'?'向下 ↓':'向上 ↑'}</small></span><button className="text-button" onClick={invite}>复制邀请 ↗</button></div>
    <div className="gravity-columns" aria-label="投放棋子">{Array.from({length:7},(_,i)=><button key={i} aria-label={`投放第 ${i+1} 列`} disabled={!available||s.cells.filter((_,n)=>n%7===i).every(Boolean)} onClick={()=>send('drop',i)}>{i+1}<span>{s.direction==='down'?'↓':'↑'}</span></button>)}</div>
    <div className="gravity-board" data-testid="gravity-board" data-revision={s.revision} data-direction={s.direction} data-turn={s.turn}>{s.cells.map((color,i)=><div key={i} data-testid={`gravity-cell-${i}`} data-color={color} className={`gravity-cell gravity-color-${color} ${s.winning.includes(i)?'gravity-winning':''}`}>{color||''}</div>)}</div>
    <p className="gravity-help">你是{index===0?'橙色 1 号':'蓝色 2 号'}。横、竖或斜线连成四枚即可获胜。</p>
    <button className="primary full" disabled={!available||!s.flips[index]} onClick={()=>send('flip')}>翻转重力（剩余 {s.flips[index]} 次）</button>
  </section><DuoPanel {...props} title={title}><div className="rules"><h4>一招颠倒局势</h4><p>轮到你时，可投放一枚棋子，或消耗一次机会翻转重力。翻转占用一回合，所有棋子向新方向靠拢，同列顺序不变。</p><p>翻转后立即判定胜负，也可能让对手获胜！双方同时四连或棋盘填满则平局。</p><p>对手离线时暂停，重连保留棋盘。双方确认再战后重新开始。</p></div></DuoPanel></div>;
}
