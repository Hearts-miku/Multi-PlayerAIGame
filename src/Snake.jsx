import React, { useEffect, useRef, useState } from 'react';
import './snake.css';
import GameCardSelect from './GameCardSelect.jsx';

const directions = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' };
const labels = { up: '向上', down: '向下', left: '向左', right: '向右' };

export function SnakeCard({ selected, disabled, onSelect }) {
  return <section className={`snake-card selectable-game ${selected ? 'selected-game' : ''}`}><GameCardSelect name="贪食蛇" selected={selected} disabled={disabled} onSelect={onSelect}/>
    <div className="snake-card-copy"><span className="tag">反应与默契 <span>·</span> 2 人同屏</span>
      <h2>贪食蛇 <span>SNAKE DUO</span></h2><p>各走各的精彩，或一起吃掉整片果园。<br/>叫上朋友，来一场指尖上的追逐。</p>
      <p className="snake-modes-note">双人对战 · 碰撞淘汰 / 双人合作 · 共同收集 20 个食物</p>
      <small>方向键 / WASD · 手机方向按钮 · 双方准备后开始</small>
    </div>
    <svg className="snake-art" viewBox="0 0 360 210" aria-hidden="true">
      <defs><pattern id="snake-grid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" fill="none" stroke="#ffffff09"/></pattern></defs>
      <rect width="360" height="210" rx="18" fill="#11221d"/><rect width="360" height="210" fill="url(#snake-grid)"/>
      <path d="M48 54H144V102H96V150H192" stroke="#b9ef71" strokeWidth="19" fill="none" strokeLinejoin="round" strokeLinecap="round"/>
      <path d="M312 174H264V126H312V54H240" stroke="#7bcde8" strokeWidth="19" fill="none" strokeLinejoin="round" strokeLinecap="round"/>
      <circle cx="192" cy="146" r="3" fill="#183322"/><circle cx="240" cy="50" r="3" fill="#183322"/>
      <circle cx="216" cy="102" r="8" fill="#ffaf76"/><path d="M216 92q8-10 12-3" fill="none" stroke="#b9ef71" strokeWidth="3"/>
      <circle cx="48" cy="174" r="5" fill="#ffaf76"/>
    </svg>
  </section>;
}

export default function SnakeMatch({ room, user, connected, pending, action, onTurn, invite }) {
  const s = room.snake, index = room.players.findIndex((p) => p.id === user.id);
  const [now, setNow] = useState(Date.now());
  const turnRef = useRef(onTurn); turnRef.current = onTurn;
  const canControl = connected && room.status === 'playing' && s.phase === 'running';
  useEffect(() => {
    if (!canControl) return;
    const keydown = (event) => {
      if (event.target instanceof HTMLElement && (event.target.matches('input,textarea,select') || event.target.isContentEditable)) return;
      const direction = directions[event.key] || directions[event.key.toLowerCase()];
      if (!direction) return;
      event.preventDefault(); if (!event.repeat) turnRef.current(direction);
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [canControl]);
  useEffect(() => {
    setNow(Date.now());
    if (s.phase !== 'running' || s.nextTick - Date.now() < 500) return;
    const timer = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(timer);
  }, [s.phase, s.nextTick]);
  const countdown = s.phase === 'running' && s.nextTick - now > 500 ? Math.ceil((s.nextTick - now) / 1000) : 0;
  const coop = room.mode === 'coop', score = s.scores.reduce((a, b) => a + b, 0);
  const winner = room.players.find((p) => p.color === room.winner);
  const title = room.status === 'waiting' ? '等一位朋友入场' : room.status === 'finished'
    ? room.reason === 'team-goal' ? '合作成功！' : coop ? '合作挑战结束' : winner ? `${winner.displayName} 获胜` : '势均力敌，本局平局'
    : s.phase === 'paused' ? '已暂停，等待准备' : s.phase === 'ready' ? '双方准备后开始' : countdown ? `${countdown} 秒后出发` : coop ? '一起收集，一起前进' : '保持灵活，活到最后';
  const detail = !connected ? '连接中断，正在恢复房间…' : room.status === 'waiting' ? '分享房间码，邀请朋友加入。'
    : room.status === 'finished' ? room.reason === 'team-goal' ? '你们一起收集了 20 个食物，默契满分。' : coop ? '本局结束。配合转向，再一起挑战一次。' : '碰撞即淘汰，同时碰撞为平局。'
    : s.phase === 'paused' ? '连接中断或同步延迟后会暂停。双方在线并重新准备即可继续。' : '你控制' + (index === 0 ? '绿色蛇' : '蓝色蛇') + '。方向键 / WASD 或下方按钮转向。';
  const overlay = !connected ? '重新连接中' : room.status === 'waiting' ? '等待朋友加入' : room.status === 'finished' ? title : s.phase !== 'running' ? (s.phase === 'paused' ? '暂停一下，等你回来' : '准备好，一起出发') : countdown ? countdown : null;
  return <div className="play-layout snake-layout">
    <section className="table-panel snake-table"><div className="table-heading"><span><b>贪食蛇 · {coop ? '合作' : '对战'}</b><small>SNAKE DUO</small></span><button className="text-button" onClick={invite}>复制邀请 ↗</button></div>
      <div className="snake-scorebar">{room.players.map((p, i) => <span key={p.id} className={`snake-ink-${i}`}><i/>{p.id === user.id ? '你' : p.displayName}<b>{s.scores[i]}</b></span>)}<small>{coop ? `共同目标 ${score} / ${s.goal}` : '生存对决'}</small></div>
      {coop && <progress aria-label="合作收集进度" max={s.goal} value={score}/>}
      <div className="snake-arena"><svg viewBox={`0 0 ${s.size * 20} ${s.size * 20}`} role="img" aria-label="24 行 24 列双人贪食蛇场地" data-testid="snake-board" data-tick={s.ticks} data-phase={s.phase}>
        <defs><pattern id="arena-grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="#ffffff08" strokeWidth="1"/></pattern></defs>
        <rect width="480" height="480" fill="#101f19"/><rect width="480" height="480" fill="url(#arena-grid)"/>
        {s.food.map(([x, y]) => <g key={`${x},${y}`}><circle cx={x * 20 + 10} cy={y * 20 + 11} r="6" fill="#ffaf76"/><path d={`M${x * 20 + 10} ${y * 20 + 5}q2-5 5-3`} stroke="#b9ef71" strokeWidth="2" fill="none"/></g>)}
        {s.bodies.map((body, i) => body.map(([x, y], j) => <g key={`${i},${j}`} data-testid={j === 0 ? `snake-head-${i}` : undefined} data-x={x} data-y={y}>
          <rect x={x * 20 + 1} y={y * 20 + 1} width="18" height="18" rx={j === 0 ? 6 : 4} fill={i === 0 ? '#b9ef71' : '#7bcde8'} opacity={j === 0 ? 1 : .72}/>
          {j === 0 && <g transform={`rotate(${{ right: 0, down: 90, left: 180, up: 270 }[s.directions[i]]} ${x * 20 + 10} ${y * 20 + 10})`}><circle cx={x * 20 + 14} cy={y * 20 + 6} r="2" fill="#153024"/><circle cx={x * 20 + 14} cy={y * 20 + 14} r="2" fill="#153024"/></g>}
        </g>))}
      </svg>{overlay !== null && <div className="snake-overlay"><strong>{overlay}</strong><span>{room.status === 'finished' ? `绿色 ${s.scores[0]} · 蓝色 ${s.scores[1]}` : '两个人，同一片果园'}</span></div>}</div>
      <div className="snake-controls"><div><strong className={`snake-ink-${index}`}>你是{index === 0 ? '绿色' : '蓝色'}蛇</strong><p>方向键 / WASD<br/>不能直接掉头</p></div><div className="direction-pad" role="group" aria-label="贪食蛇方向控制">{[['up', '↑'], ['left', '←'], ['down', '↓'], ['right', '→']].map(([direction, arrow]) => <button key={direction} className={`direction-${direction}`} aria-label={labels[direction]} disabled={!canControl} onClick={() => onTurn(direction)}>{arrow}</button>)}</div></div>
    </section>
    <aside className="match-panel snake-panel"><span className="eyebrow">{coop ? 'BETTER TOGETHER' : 'LAST SNAKE STANDING'}</span><h2 aria-live="polite">{title}</h2><p>{detail}</p>
      <div className="players">{room.players.map((p, i) => <div className="player" key={p.id}><span className={`snake-player-dot snake-fill-${i}`}/><div><strong>{p.displayName}{p.id === user.id ? ' · 你' : ''}</strong><small>{p.online ? '在线' : '离线'} · {s.ready.includes(p.id) ? '已准备' : '未准备'}</small></div></div>)}</div>
      <div className="room-code-box"><small>房间码</small><strong>{room.id}</strong><button className="text-button" onClick={invite}>邀请朋友 ↗</button></div>
      {room.status === 'playing' && s.phase !== 'running' && <button className="primary full" disabled={!connected || pending || s.ready.includes(user.id) || room.players.some((p) => !p.online)} onClick={() => action('snake:ready')}>{s.ready.includes(user.id) ? '已准备，等待朋友…' : s.phase === 'paused' ? '准备继续' : '准备开始'}</button>}
      {room.status === 'finished' && <button className="primary full" disabled={!connected || pending || room.rematch.includes(user.id)} onClick={() => action('game:rematch')}>{room.rematch.includes(user.id) ? '已准备，等待朋友…' : room.rematch.length ? '接受再来一局' : '再来一局'}</button>}
      {room.status === 'playing' && <button className="secondary full snake-end" disabled={!connected || pending} onClick={() => { if (confirm(coop ? '确定结束本次合作挑战吗？' : '确定认输吗？')) action('game:resign'); }}>{coop ? '结束挑战' : '认输'}</button>}
      <button className="text-button leave-button" disabled={!connected || pending} onClick={() => { if (confirm('离开会关闭双方的房间，确定吗？')) action('room:leave'); }}>离开房间</button>
      <div className="rules"><h4>{coop ? '一起完成 20 个食物' : '活到最后就是赢家'}</h4><p>{coop ? '双方得分相加达到 20 即成功。任意一条蛇碰撞，合作挑战结束。' : '先碰撞的玩家失败；双方同一步碰撞则平局。食物让蛇变长，也让围堵更有策略。'}</p><p>撞墙、撞到自己或另一条蛇都会失败；双方迎头相撞也算碰撞。每 0.3 秒前进一步，每步只能转向一次。</p><p>双方准备后倒数 3 秒。断线或同步延迟会暂停，重连后双方准备继续。</p></div>
    </aside>
  </div>;
}
