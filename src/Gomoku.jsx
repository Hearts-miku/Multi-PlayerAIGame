import React from 'react';
import GameCardSelect from './GameCardSelect.jsx';

export function Board({ room, user, onMove, connected, pending, decorative = false }) {
  const last = room?.moves.at(-1);
  const color = room?.players.find((p) => p.id === user?.id)?.color;
  const demo = { '112': 1, '113': 2, '97': 1, '127': 2, '82': 1, '98': 2, '67': 1, '111': 2 };
  return <div className={`board-wrap ${decorative ? 'decorative' : ''}`}>
    <div className="coordinates">{Array.from({ length: 15 }, (_, i) => <span key={i}>{String.fromCharCode(65 + i)}</span>)}</div>
    <div className="board" role={decorative ? undefined : 'group'} aria-label="15 行 15 列五子棋棋盘">
      {Array.from({ length: 225 }, (_, index) => {
        const x = index % 15, y = Math.floor(index / 15), stone = decorative ? demo[index] : room?.board[index];
        const winning = room?.winLine.some(([wx, wy]) => x === wx && y === wy);
        return <button key={index} type="button" className={`cell ${x === 0 ? 'left-edge' : ''} ${x === 14 ? 'right-edge' : ''} ${y === 0 ? 'top-edge' : ''} ${y === 14 ? 'bottom-edge' : ''} ${[3, 7, 11].includes(x) && [3, 7, 11].includes(y) && (x === y || x + y === 14) ? 'star-point' : ''}`} aria-label={`${String.fromCharCode(65 + x)}${y + 1}${stone ? (stone === 1 ? ' 黑子' : ' 白子') : ' 空位'}`} disabled={decorative || !connected || pending || room?.status !== 'playing' || color !== room?.turn || !!stone} onClick={() => onMove(x, y)}>
          {stone ? <span className={`stone stone-${stone} ${winning ? 'winning' : ''}`}>{last?.x === x && last?.y === y && <i/>}</span> : <span className={`ghost stone-${color || 1}`}/>}
        </button>;
      })}
    </div>
  </div>;
}

export function GomokuCard({ selected, disabled, onSelect }) {
  return <section className={`game-card selectable-game ${selected ? 'selected-game' : ''}`}><GameCardSelect name="五子棋" selected={selected} disabled={disabled} onSelect={onSelect}/><div className="game-copy"><span className="tag">经典策略 <span>·</span> 2 人对战</span><h2>五子棋<span>GOMOKU</span></h2><p>黑白之间，步步为营。<br/>先连成五子的人，赢下这一局。</p><div className="game-facts"><span>15 × 15 棋盘</span><span>自由规则</span><span>实时对战</span></div><small>双人对战 · 朋友加入后自动开局</small></div><div className="game-art"><Board decorative/><span className="art-caption">每一步，都有无限可能。</span></div></section>;
}
export default function GomokuMatch({ room, user, connected, pending, action, invite }) {
  const me = room?.players.find((p) => p.id === user?.id), opponent = room?.players.find((p) => p.id !== user?.id);
  const status = room?.status === 'waiting' ? '等一位朋友入座' : room?.status === 'finished' ? (room.winner ? `${room.players.find((p) => p.color === room.winner)?.displayName} 获胜` : '势均力敌，本局和棋') : room?.turn === me?.color ? '轮到你落子了' : '对手正在思考';
  return <div className="play-layout"><section className="table-panel"><div className="table-heading"><span><b>五子棋</b><small>GOMOKU / {room.id}</small></span><button className="text-button" onClick={invite}>复制邀请 ↗</button></div><Board room={room} user={user} connected={connected} pending={pending} onMove={(x, y) => action('game:move', { x, y })}/><div className="board-footer"><span>黑棋先行 · 五子连珠获胜</span><span>第 {room.moves.length} 手</span></div></section><aside className="match-panel"><span className="eyebrow">LIVE MATCH</span><h2 aria-live="polite">{status}</h2><p>{!connected ? '网络断开，正在重连。棋局会为你保留。' : room.status === 'waiting' ? '分享房间码或邀请链接，朋友加入后自动开局。' : room.status === 'finished' ? (room.reason === 'resign' ? '本局以认输结束。' : '好棋！准备好再切磋一局了吗？') : `你执${me?.color === 1 ? '黑' : '白'}棋，${room.turn === 1 ? '黑' : '白'}棋回合。`}</p><div className="players">{[me, opponent].map((p, index) => <div key={index} className={`player ${p && room.status === 'playing' && room.turn === p.color ? 'current' : ''}`}><span className={`player-stone stone-${p?.color || 2}`}/><div><strong>{p?.displayName || '等待朋友加入'}</strong><small>{p ? `${index === 0 ? '你' : '对手'} · ${p.online ? '在线' : '离线，等待重连'}` : '空座位'}</small></div>{p && room.turn === p.color && room.status === 'playing' && <span className="turn-dot"/>}</div>)}</div><div className="room-code-box"><small>房间码</small><strong>{room.id}</strong><button className="text-button" onClick={invite}>邀请朋友 ↗</button></div>{room.status === 'finished' && <button className="primary full" disabled={!connected || pending || room.rematch.includes(user.id)} onClick={() => action('game:rematch')}>{room.rematch.includes(user.id) ? '已准备，等待对手…' : room.rematch.length ? '对手想再来一局 · 接受' : '再来一局 · 交换黑白'}</button>}{room.status === 'playing' && <button className="secondary full" disabled={!connected || pending} onClick={() => { if (confirm('确定认输并结束本局吗？')) action('game:resign'); }}>认输</button>}<button className="text-button leave-button" disabled={!connected || pending} onClick={() => { if (confirm('离开将关闭双方的房间，确定离开吗？')) action('room:leave'); }}>离开房间</button><div className="rules"><h4>落子小贴士</h4><p>横、竖、斜任一方向连成五子即获胜。采用自由五子棋规则，无禁手，长连也算获胜。</p><p>刷新或短暂断线后可返回原棋局。离开房间会关闭双方的棋桌。</p></div></aside></div>;
}
