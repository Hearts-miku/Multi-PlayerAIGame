import React, { useEffect, useRef } from 'react';
import GameCardSelect from './GameCardSelect.jsx';
import './sokoban.css';

const keys = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' };
const colors = ['#ffbf79', '#80d7ef'];
const same = (a, b) => a[0] === b[0] && a[1] === b[1];

export function SokobanCard({ selected, disabled, onSelect }) {
  return <section className={`sokoban-card selectable-game ${selected ? 'selected-game' : ''}`}>
    <GameCardSelect name="默契搬运队" selected={selected} disabled={disabled} onSelect={onSelect}/>
    <div className="sokoban-card-copy"><span className="tag">合作解谜 · 2 人闯关</span><h2>默契搬运队<span>BETTER TOGETHER</span></h2><p>你来开门，我来搬运。<br/>把箱子送回家，把默契练出来。</p><div className="sokoban-card-facts">3 个关卡 · 机关门 · 双人推箱子</div><small>方向键 / WASD / 触屏 · 不计时，慢慢商量</small></div>
    <svg viewBox="0 0 320 200" className="sokoban-card-art" aria-hidden="true"><rect width="320" height="200" rx="18" fill="#152126"/>
      {[0,1,2,3,4].map((i) => <path key={i} d={`M0 ${i*40}H320M${i*64} 0V200`} stroke="#ffffff08"/>)}
      <path d="M95 145V65H225" stroke="#b9ef7166" strokeWidth="4" strokeDasharray="6 7" fill="none"/>
      <rect x="122" y="45" width="42" height="42" rx="8" fill="#ffbf79"/><path d="M130 53l26 26m0-26l-26 26" stroke="#754726" strokeWidth="3"/>
      <rect x="202" y="112" width="42" height="42" rx="8" fill="#80d7ef"/><path d="M210 120l26 26m0-26l-26 26" stroke="#215162" strokeWidth="3"/>
      <circle cx="95" cy="145" r="19" fill="#ffbf79"/><text x="95" y="151" textAnchor="middle" fontSize="18" fill="#4c311c">1</text>
      <circle cx="265" cy="133" r="19" fill="#80d7ef"/><text x="265" y="139" textAnchor="middle" fontSize="18" fill="#193d49">2</text>
      <circle cx="225" cy="65" r="18" stroke="#ffbf79" strokeWidth="3" fill="none"/>
    </svg>
  </section>;
}

export default function SokobanMatch({ room, user, connected, pending, action, invite }) {
  const s = room.sokoban, index = room.players.findIndex((p) => p.id === user.id);
  const bothOnline = room.players.length === 2 && room.players.every((p) => p.online);
  const available = connected && !pending && bothOnline && room.status === 'playing';
  const controllable = available && s.phase === 'active';
  const flight = useRef(false), moveRef = useRef(null);
  async function command(kind, direction) {
    if (!available || flight.current) return;
    flight.current = true;
    try { await action('sokoban:action', { kind, direction, round: s.round, revision: s.revision }); }
    finally { flight.current = false; }
  }
  moveRef.current = (direction) => command('move', direction);
  useEffect(() => {
    if (!controllable) return;
    const handler = (event) => {
      if (event.target instanceof HTMLElement && (event.target.matches('input,textarea,select') || event.target.isContentEditable)) return;
      const direction = keys[event.key] || keys[event.key.toLowerCase()];
      if (direction) { event.preventDefault(); if (!event.repeat) moveRef.current(direction); }
    };
    window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler);
  }, [controllable]);
  const open = s.plates.some((plate) => s.actors.some((p) => same(p, plate)));
  const delivered = s.boxes.filter((box, i) => same(box, s.goals[i])).length;
  const title = room.status === 'waiting' ? '等队友，一起开工' : room.status === 'finished' ? room.reason === 'sokoban-complete' ? '默契满分，全部通关！' : '本次挑战已结束' : s.phase === 'cleared' ? '本关完成！' : !bothOnline ? '等队友回来，进度已保留' : s.name;
  return <div className="play-layout sokoban-layout">
    <section className="table-panel sokoban-table"><div className="table-heading"><span><b>默契搬运队</b><small>第 {s.level + 1} / {s.totalLevels} 关</small></span><button className="text-button" onClick={invite}>复制邀请 ↗</button></div>
      <div className="sokoban-score"><span>已归位 <b>{delivered} / 2</b></span><span>共同走了 <b>{s.moves}</b> 步</span>{s.gates.length > 0 && <span>{open ? '机关门已打开' : '踩住机关开门'}</span>}</div>
      <svg className="sokoban-board" viewBox={`0 0 ${s.width * 40} ${s.height * 40}`} role="img" aria-label={`默契搬运队第 ${s.level + 1} 关棋盘`} data-testid="sokoban-board" data-level={s.level} data-round={s.round} data-revision={s.revision} data-phase={s.phase} data-moves={s.moves}>
        <rect width={s.width * 40} height={s.height * 40} fill="#142025" rx="10"/>
        {Array.from({ length: s.width * s.height }, (_, i) => <rect key={i} x={(i % s.width)*40+1} y={Math.floor(i/s.width)*40+1} width="38" height="38" rx="4" fill="#1c2d31"/>)}
        {s.walls.map(([x,y]) => <g key={`${x},${y}`}><rect x={x*40+2} y={y*40+2} width="36" height="36" rx="5" fill="#425257"/><path d={`M${x*40+7} ${y*40+13}h26m-13 0v19`} stroke="#53666b" strokeWidth="2"/></g>)}
        {s.goals.map(([x,y],i) => <g key={i}><circle cx={x*40+20} cy={y*40+20} r="13" fill="none" stroke={colors[i]} strokeWidth="2" strokeDasharray="4 3"/><text x={x*40+20} y={y*40+25} textAnchor="middle" fill={colors[i]} fontSize="13">{i+1}</text></g>)}
        {s.plates.map(([x,y]) => <g key={`${x},${y}`}><rect x={x*40+7} y={y*40+7} width="26" height="26" rx="5" fill={s.actors.some((p)=>same(p,[x,y])) ? '#b9ef71' : '#53683b'} stroke="#b9ef71"/><text x={x*40+20} y={y*40+25} textAnchor="middle" fontSize="17" fill="#182519">⚡</text></g>)}
        {s.gates.map(([x,y]) => <rect key={`${x},${y}`} x={x*40+4} y={y*40+4} width="32" height="32" rx="3" fill={open ? '#b9ef7110' : '#7c925d'} stroke="#b9ef71" strokeWidth="3" strokeDasharray={open ? '3 5' : undefined}/>)}
        {s.boxes.map(([x,y],i) => <g key={i} data-testid={`sokoban-box-${i}`} data-x={x} data-y={y}><rect x={x*40+5} y={y*40+5} width="30" height="30" rx="5" fill={colors[i]}/><path d={`M${x*40+11} ${y*40+11}l18 18m0-18l-18 18`} stroke="#172b31" opacity=".45" strokeWidth="3"/>{same([x,y],s.goals[i]) && <text x={x*40+20} y={y*40+25} textAnchor="middle" fontSize="19" fill="#163321">✓</text>}</g>)}
        {s.actors.map(([x,y],i) => <g key={i} data-testid={`sokoban-player-${i}`} data-x={x} data-y={y}><circle cx={x*40+20} cy={y*40+20} r="14" fill={colors[i]} stroke={i===index ? '#ffffff' : '#142025'} strokeWidth="3"/><text x={x*40+20} y={y*40+25} textAnchor="middle" fontSize="15" fontWeight="bold" fill="#183039">{i+1}</text></g>)}
      </svg>
      <div className="sokoban-controls"><div><strong style={{ color: colors[index] }}>你是 {index + 1} 号 · {index === 0 ? '橙色' : '蓝色'}</strong><p>方向键 / WASD / 方向按钮<br/>圆形是玩家，方形是箱子</p></div><div className="sokoban-pad" role="group" aria-label="搬运队方向控制">{[['up','↑','向上'],['left','←','向左'],['down','↓','向下'],['right','→','向右']].map(([direction,arrow,label]) => <button key={direction} className={`sokoban-${direction}`} aria-label={label} disabled={!controllable} onClick={() => command('move',direction)}>{arrow}</button>)}</div></div>
      <p className="sokoban-hint">✦ {s.hint}</p>
    </section>
    <aside className="match-panel sokoban-panel"><span className="eyebrow">TWO HANDS, ONE PLAN</span><h2 aria-live="polite">{title}</h2><p>{!connected ? '连接恢复后继续，关卡和步数会保留。' : room.status === 'waiting' ? '把房间码发给队友，两人到齐即可开始。' : '把各自的箱子送到同色圆点，两只箱子都归位才算过关。'}</p>
      <div className="players">{room.players.map((p,i) => <div className="player" key={p.id}><span className="sokoban-avatar" style={{ background: colors[i] }}>{i+1}</span><div><strong>{p.displayName}{p.id===user.id ? ' · 你' : ''}</strong><small>{p.online ? '在线' : '离线'} · 推箱 {s.pushes[i]} 次</small></div></div>)}</div>
      <div className="room-code-box"><small>房间码</small><strong>{room.id}</strong><button className="text-button" onClick={invite}>邀请朋友 ↗</button></div>
      {room.status === 'playing' && <div className="sokoban-actions">
        {s.phase === 'cleared' && <button className="primary full" disabled={!available || s.votes.next.includes(user.id)} onClick={() => command('next')}>{s.votes.next.includes(user.id) ? '已准备，等队友…' : s.votes.next.length ? '一起进入下一关' : '准备下一关'}</button>}
        <button className="secondary full" disabled={!available || s.history.at(-1)?.userId !== user.id} onClick={() => command('undo')}>撤销我的最后一步</button>
        <button className="secondary full" disabled={!available || s.votes.restart.includes(user.id)} onClick={() => command('restart')}>{s.votes.restart.includes(user.id) ? '已申请重开，等队友…' : s.votes.restart.length ? '同意重开本关' : '申请重开本关'}</button>
        <small>双方确认才重开或换关；继续移动会取消待确认请求。</small>
      </div>}
      {room.status === 'finished' && <button className="primary full" disabled={!connected || pending || room.rematch.includes(user.id)} onClick={() => action('game:rematch')}>{room.rematch.includes(user.id) ? '已准备，等队友…' : room.rematch.length ? '接受重新挑战' : '重新挑战三关'}</button>}
      <button className="text-button leave-button" disabled={!connected || pending} onClick={() => { if (confirm('离开会关闭双方的房间，确定吗？')) action('room:leave'); }}>离开房间</button>
      <div className="rules"><h4>合作小贴士</h4><p>只能推自己的箱子，不能拉、不能一次推两个，也不能穿过队友。箱子推到死角时，撤销最后一步或双方重开。</p><p>站在绿色机关上，门就会打开。门中有人或箱子时，踩机关的人要等他们通过再离开。</p><p>不计时、不抢回合。队友离线时暂停操作，重新登录即可继续。</p></div>
    </aside>
  </div>;
}
