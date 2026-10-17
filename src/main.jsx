import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { io } from 'socket.io-client';
import './style.css';

async function api(path, body) {
  const response = await fetch(`/api/auth/${path}`, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {});
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '请求失败，请稍后重试');
  return data;
}

function Mark() { return <span className="brand-mark"><i/><i/></span>; }
function Board({ room, user, onMove, connected, pending, decorative = false }) {
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

function Auth({ onAuth }) {
  const [mode, setMode] = useState('login'), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault(); setError(''); setBusy(true);
    const body = Object.fromEntries(new FormData(event.currentTarget));
    try { onAuth((await api(mode, body)).user); } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  return <div className="auth-layout">
    <section className="auth-intro"><span className="eyebrow"><span className="live-dot"/> SMALL GAMES, REAL CONNECTIONS</span><h1>好玩的事，<br/>一起才<span>有意思。</span></h1><p>找一位朋友，坐到同一张桌前。<br/>从一局五子棋开始，把闲暇变成好时光。</p><div className="intro-board"><Board decorative/><span className="floating-label">● 黑棋先行 · 轮到你了</span></div><div className="intro-foot"><span>01 / 五子棋</span><span>两个人，一场好棋 ↗</span></div></section>
    <section className="auth-card"><span className="eyebrow">YOUR SEAT IS READY</span><h2>{mode === 'login' ? '欢迎回到同桌' : '先认识一下吧'}</h2><p>{mode === 'login' ? '登录账号，接着和朋友玩。' : '创建一个账号，开启你的第一局。'}</p><div className="tabs"><button className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setError(''); }}>登录</button><button className={mode === 'register' ? 'active' : ''} onClick={() => { setMode('register'); setError(''); }}>注册账号</button></div>
      <form onSubmit={submit} key={mode}><label>账号<input name="username" autoComplete="username" required minLength={3} maxLength={24} pattern="[a-zA-Z0-9_]+" placeholder="字母、数字或下划线"/></label>{mode === 'register' && <label>怎么称呼你<input name="displayName" autoComplete="nickname" required maxLength={20} placeholder="朋友们看到的昵称"/></label>}<label>密码<input name="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={mode === 'register' ? 10 : 1} maxLength={128} placeholder={mode === 'register' ? '至少 10 位，设置一个安全的密码' : '输入你的密码'}/></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="primary full" disabled={busy}>{busy ? '请稍候…' : mode === 'login' ? '进入游戏大厅 ↗' : '创建账号，开始玩 ↗'}</button></form><div className="auth-note"><span>◇</span> 你的账号用于识别玩家与同步对局</div></section>
  </div>;
}

function App() {
  const [user, setUser] = useState(null), [loading, setLoading] = useState(true), [connected, setConnected] = useState(false), [room, setRoom] = useState(null), [lobby, setLobby] = useState({ online: 0, rooms: [] }), [notice, setNotice] = useState(''), [pending, setPending] = useState(false), [code, setCode] = useState(new URLSearchParams(location.search).get('room') || '');
  const socketRef = useRef(null);
  useEffect(() => { api('me').then((data) => setUser(data.user)).catch(() => {}).finally(() => setLoading(false)); }, []);
  useEffect(() => {
    if (!user) return;
    const socket = io({ autoConnect: false }); socketRef.current = socket;
    socket.on('connect', () => { setConnected(true); setNotice(''); });
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', (e) => setNotice(`连接失败：${e.message}。正在尝试重新连接…`));
    socket.on('lobby:update', setLobby); socket.on('room:update', setRoom); socket.on('notice', setNotice);
    socket.on('room:closed', (message) => { setRoom(null); setNotice(message); });
    socket.on('session:expired', () => { setUser(null); setRoom(null); setNotice('登录状态已失效，请重新登录'); });
    socket.connect();
    return () => { socket.disconnect(); socketRef.current = null; setConnected(false); };
  }, [user?.id]);
  async function action(event, payload = {}) {
    if (pending || !connected) return;
    setPending(true); setNotice('');
    try {
      const response = await socketRef.current.timeout(5000).emitWithAck(event, payload);
      if (!response.ok) throw new Error(response.error);
    } catch (e) { setNotice(e.message === 'operation has timed out' ? '操作超时，请检查连接后重试' : e.message); } finally { setPending(false); }
  }
  async function logout() {
    try { await api('logout', {}); socketRef.current?.disconnect(); setUser(null); setRoom(null); setNotice(''); } catch (e) { setNotice(e.message); }
  }
  async function invite() {
    const link = `${location.origin}/?room=${room.id}`;
    try { await navigator.clipboard.writeText(link); setNotice('邀请链接已复制，发给朋友即可加入'); } catch { setNotice(`请复制邀请链接：${link}`); }
  }
  const me = room?.players.find((p) => p.id === user?.id), opponent = room?.players.find((p) => p.id !== user?.id);
  const status = room?.status === 'waiting' ? '等一位朋友入座' : room?.status === 'finished' ? (room.winner ? `${room.players.find((p) => p.color === room.winner)?.displayName} 获胜` : '势均力敌，本局和棋') : room?.turn === me?.color ? '轮到你落子了' : '对手正在思考';
  return <><header className="header"><a href="/" className="brand"><Mark/><strong>同桌<span>PLAY TOGETHER</span></strong></a><nav><span className="nav-active">游戏空间</span><span className="nav-note">与朋友一起，随时开局</span></nav>{user ? <div className="profile"><span className="avatar">{user.displayName.slice(0, 1)}</span><span>{user.displayName}</span><button className="text-button" onClick={logout}>退出</button></div> : <span className="header-note">留一点时间，给好玩的事</span>}</header>
    <main>{loading ? <div className="loading">正在准备你的座位…</div> : !user ? <Auth onAuth={setUser}/> : <>
      <div className="page-heading"><div><span className="eyebrow">LET'S PLAY SOMETHING</span><h1>{room ? '落子之间，见高下。' : `晚上好，${user.displayName}。`.replace('晚上好', new Date().getHours() < 12 ? '上午好' : new Date().getHours() < 18 ? '下午好' : '晚上好')}</h1><p>{room ? '不急，想好这一步。' : '找一款喜欢的游戏，叫上朋友一起玩。'}</p></div><div className="online-badge"><span className={connected ? 'live-dot' : 'offline-dot'}/>{connected ? `${lobby.online} 位玩家在线` : '连接中…'}</div></div>
      {notice && <div className="notice" role="status">{notice}<button aria-label="关闭提示" onClick={() => setNotice('')}>×</button></div>}
      {!room ? <><div className="section-caption"><span>所有游戏 <b>01</b></span><span>轻松开局 · 即时同乐</span></div><div className="lobby-layout"><section className="game-card"><div className="game-copy"><span className="tag">经典策略 <span>·</span> 2 人对战</span><h2>五子棋<span>GOMOKU</span></h2><p>黑白之间，步步为营。<br/>先连成五子的人，赢下这一局。</p><div className="game-facts"><span>15 × 15 棋盘</span><span>自由规则</span><span>实时对战</span></div><button className="primary" disabled={!connected || pending} onClick={() => action('room:create')}>创建房间 <span>↗</span></button><small>创建后，把邀请链接发给你的朋友</small></div><div className="game-art"><Board decorative/><span className="art-caption">每一步，都有无限可能。</span></div></section><aside className="join-card"><span className="outline-icon">⌘</span><h3>朋友已经在等你？</h3><p>输入房间码，坐到 TA 对面。</p><form onSubmit={(e) => { e.preventDefault(); action('room:join', { id: code }); }}><label htmlFor="room-code">房间码</label><input id="room-code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={8} minLength={8} required placeholder="例如 A1B2C3D4" autoComplete="off"/><button className="secondary full" disabled={!connected || pending}>加入房间 →</button></form><div className="little-rule"><span>✳</span><p>相隔再远，<br/>也能在同一张桌前。</p></div></aside></div><section className="rooms-section"><div className="section-caption"><span>开放房间 <b>{lobby.rooms.length.toString().padStart(2, '0')}</b></span><span>大厅内的房间对所有登录玩家可见</span></div>{lobby.rooms.length ? <div className="room-list">{lobby.rooms.map((r) => <article key={r.id}><span className="room-icon">◉</span><div><h4>{r.host} 的棋桌</h4><p>{r.id} · {r.count}/2 人</p></div><span className="room-state">{r.status === 'waiting' ? '等待入座' : r.status === 'playing' ? '对局中' : '已结束'}</span><button className="secondary" disabled={r.status !== 'waiting' || !connected || pending} onClick={() => action('room:join', { id: r.id })}>加入 ↗</button></article>)}</div> : <div className="empty-state"><span>⌑</span><div><h4>第一张棋桌，等你来开</h4><p>创建一个房间，邀请朋友来玩吧。</p></div><span className="empty-arrow">↗</span></div>}</section></> : <div className="play-layout"><section className="table-panel"><div className="table-heading"><span><b>五子棋</b><small>GOMOKU / {room.id}</small></span><button className="text-button" onClick={invite}>复制邀请 ↗</button></div><Board room={room} user={user} connected={connected} pending={pending} onMove={(x, y) => action('game:move', { x, y })}/><div className="board-footer"><span>黑棋先行 · 五子连珠获胜</span><span>第 {room.moves.length} 手</span></div></section><aside className="match-panel"><span className="eyebrow">LIVE MATCH</span><h2 aria-live="polite">{status}</h2><p>{!connected ? '网络断开，正在重连。棋局会为你保留。' : room.status === 'waiting' ? '分享房间码或邀请链接，朋友加入后自动开局。' : room.status === 'finished' ? (room.reason === 'resign' ? '本局以认输结束。' : '好棋！准备好再切磋一局了吗？') : `你执${me?.color === 1 ? '黑' : '白'}棋，${room.turn === 1 ? '黑' : '白'}棋回合。`}</p><div className="players">{[me, opponent].map((p, index) => <div key={index} className={`player ${p && room.status === 'playing' && room.turn === p.color ? 'current' : ''}`}><span className={`player-stone stone-${p?.color || 2}`}/><div><strong>{p?.displayName || '等待朋友加入'}</strong><small>{p ? `${index === 0 ? '你' : '对手'} · ${p.online ? '在线' : '离线，等待重连'}` : '空座位'}</small></div>{p && room.turn === p.color && room.status === 'playing' && <span className="turn-dot"/>}</div>)}</div><div className="room-code-box"><small>房间码</small><strong>{room.id}</strong><button className="text-button" onClick={invite}>邀请朋友 ↗</button></div>{room.status === 'finished' && <button className="primary full" disabled={!connected || pending || room.rematch.includes(user.id)} onClick={() => action('game:rematch')}>{room.rematch.includes(user.id) ? '已准备，等待对手…' : room.rematch.length ? '对手想再来一局 · 接受' : '再来一局 · 交换黑白'}</button>}{room.status === 'playing' && <button className="secondary full" disabled={!connected || pending} onClick={() => { if (confirm('确定认输并结束本局吗？')) action('game:resign'); }}>认输</button>}<button className="text-button leave-button" disabled={!connected || pending} onClick={() => { if (confirm('离开将关闭双方的房间，确定离开吗？')) action('room:leave'); }}>离开房间</button><div className="rules"><h4>落子小贴士</h4><p>横、竖、斜任一方向连成五子即获胜。采用自由五子棋规则，无禁手，长连也算获胜。</p><p>刷新或短暂断线后可返回原棋局。离开房间会关闭双方的棋桌。</p></div></aside></div>}
    </>}</main><footer><span>同桌 <span className="footer-divider">/</span> 小游戏，大乐趣。</span><span>MADE FOR GOOD TIMES <span className="footer-dot">✳</span></span></footer></>;
}

createRoot(document.getElementById('root')).render(<App/>);
