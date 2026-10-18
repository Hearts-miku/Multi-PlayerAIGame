import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { io } from 'socket.io-client';
import './style.css';
import { Board } from './Gomoku.jsx';
import { GAME_VIEWS } from './game-views.js';
import { gameInfo } from '../shared/games.js';
import GameBoundary from './GameBoundary.jsx';
import RoomCreator from './RoomCreator.jsx';

async function api(path, body) {
  const response = await fetch(`/api/auth/${path}`, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {});
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '请求失败，请稍后重试');
  return data;
}

function Mark() { return <span className="brand-mark"><i/><i/></span>; }
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
  const [selection, setSelection] = useState({ game: null, mode: 'versus' });
  const [creatorOpen, setCreatorOpen] = useState(false);
  function selectGame(game) {
    if (pending || !connected) return;
    const info = gameInfo(game);
    if (!info) return;
    setSelection({ game, mode: Object.keys(info.modes)[0] });
    setNotice('');
    setCreatorOpen(true);
  }
  useEffect(() => { api('me').then((data) => setUser(data.user)).catch(() => {}).finally(() => setLoading(false)); }, []);
  useEffect(() => {
    if (!user) return;
    const socket = io({ autoConnect: false, path: '/api/server', addTrailingSlash: false, transports: ['websocket'] }); socketRef.current = socket;
    socket.on('connect', () => { setConnected(true); setNotice(''); });
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', (e) => setNotice(`连接失败：${e.message}。正在尝试重新连接…`));
    socket.on('lobby:update', setLobby); socket.on('room:update', (next) => setRoom((previous) => previous?.id === next?.id && (previous?.revision || 0) > (next?.revision || 0) ? previous : next)); socket.on('notice', setNotice);
    socket.on('room:closed', (message) => { setRoom(null); setNotice(message); });
    socket.on('session:expired', () => { setUser(null); setRoom(null); setNotice('登录状态已失效，请重新登录'); });
    socket.connect();
    return () => { socket.disconnect(); socketRef.current = null; setConnected(false); };
  }, [user?.id]);
  async function action(event, payload = {}) {
    if (pending || !connected) return;
    setPending(true); setNotice('');
    try {
      const response = await socketRef.current.timeout(15000).emitWithAck(event, payload);
      if (!response.ok) throw new Error(response.error);
      return true;
    } catch (e) { setNotice(e.message === 'operation has timed out' ? '操作超时，请检查连接后重试' : e.message); } finally { setPending(false); }
  }
  function joinRoom(id) { return action('room:join', { id: id.trim().toUpperCase() }); }
  const turning = useRef(false);
  async function turnSnake(direction) {
    if (!connected || turning.current) return;
    turning.current = true;
    try {
      const result = await socketRef.current.timeout(5000).emitWithAck('snake:turn', { direction });
      if (!result.ok) setNotice(result.error);
    } catch { setNotice('转向未确认，请检查连接'); } finally { turning.current = false; }
  }
  async function logout() {
    try { await api('logout', {}); socketRef.current?.disconnect(); setUser(null); setRoom(null); setNotice(''); } catch (e) { setNotice(e.message); }
  }
  async function invite() {
    const link = `${location.origin}/?room=${room.id}`;
    try { await navigator.clipboard.writeText(link); setNotice('邀请链接已复制，发给朋友即可加入'); } catch { setNotice(`请复制邀请链接：${link}`); }
  }
  const activeView = GAME_VIEWS[room?.game ?? 'gomoku'];
  const ActiveMatch = activeView?.Match;
  return <><header className="header"><a href="/" className="brand"><Mark/><strong>同桌<span>PLAY TOGETHER</span></strong></a><nav><span className="nav-active">游戏空间</span><span className="nav-note">与朋友一起，随时开局</span></nav>{user ? <div className="profile"><span className="avatar">{user.displayName.slice(0, 1)}</span><span>{user.displayName}</span><button className="text-button" onClick={logout}>退出</button></div> : <span className="header-note">留一点时间，给好玩的事</span>}</header>
    <main>{loading ? <div className="loading">正在准备你的座位…</div> : !user ? <Auth onAuth={setUser}/> : <>
      <div className="page-heading"><div><span className="eyebrow">LET'S PLAY SOMETHING</span><h1>{room ? activeView?.heading || '游戏房间' : `晚上好，${user.displayName}。`.replace('晚上好', new Date().getHours() < 12 ? '上午好' : new Date().getHours() < 18 ? '下午好' : '晚上好')}</h1><p>{room ? activeView?.description || '请刷新页面获取最新游戏。' : '找一款喜欢的游戏，叫上朋友一起玩。'}</p></div><div className="online-badge"><span className={connected ? 'live-dot' : 'offline-dot'}/>{connected ? `${lobby.online} 位玩家在线` : '连接中…'}</div></div>
      {notice && <div className="notice" role="status">{notice}<button aria-label="关闭提示" onClick={() => setNotice('')}>×</button></div>}
      {!room ? <><aside className="join-card shared-join" aria-label="加入房间"><span className="outline-icon">⌘</span><h3>加入朋友的房间</h3><p>五子棋、贪食蛇共用入口，自动识别游戏和模式。</p><form onSubmit={(e) => { e.preventDefault(); joinRoom(code); }}><label htmlFor="room-code">房间码</label><input id="room-code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={8} minLength={8} required placeholder="例如 A1B2C3D4" autoComplete="off"/><button className="secondary full" disabled={!connected || pending}>加入房间 →</button></form><div className="little-rule"><span>✳</span><p>也可以在下方开放房间列表中<br/>直接点击「加入房间」。</p></div></aside><div className="section-caption"><span>创建房间 <b>{Object.keys(GAME_VIEWS).length.toString().padStart(2, '0')} 款游戏</b></span><span>点击游戏卡片，选择模式后创建</span></div><div className="game-catalog">{Object.entries(GAME_VIEWS).map(([id, view]) => <GameBoundary key={id} fallback={<p role="alert">{gameInfo(id)?.name || id} 暂时不可用，请选择其他游戏。</p>}><view.Card selected={selection.game === id} disabled={!connected || pending} onSelect={() => selectGame(id)}/></GameBoundary>)}</div><RoomCreator open={creatorOpen} game={selection.game} mode={selection.mode} onSelectMode={(mode) => setSelection((previous) => ({ ...previous, mode }))} disabled={!connected || pending} pending={pending} error={notice} onClose={() => setCreatorOpen(false)} onCreate={async (options) => { if (await action('room:create', options)) setCreatorOpen(false); }}/><section className="rooms-section"><div className="section-caption"><span>开放房间 <b>{lobby.rooms.length.toString().padStart(2, '0')}</b></span><span>大厅内的房间对所有登录玩家可见</span></div>{lobby.rooms.length ? <div className="room-list">{lobby.rooms.map((r) => <article key={r.id}><span className="room-icon">◉</span><div><h4>{r.host} 的房间</h4><p>{gameInfo(r.game ?? 'gomoku')?.name || '未知游戏'} · {gameInfo(r.game ?? 'gomoku')?.modes[r.mode ?? 'versus'] || '未知模式'} · {r.id} · {r.count}/2 人</p></div><span className="room-state">{r.status === 'waiting' ? '等待加入' : r.status === 'playing' ? '对局中' : '已结束'}</span><button className="secondary" disabled={r.status !== 'waiting' || !connected || pending} onClick={() => joinRoom(r.id)}>加入房间 ↗</button></article>)}</div> : <div className="empty-state"><span>⌑</span><div><h4>第一个房间，等你来开</h4><p>创建一个房间，邀请朋友来玩吧。</p></div><span className="empty-arrow">↗</span></div>}</section></> : <GameBoundary key={room.id} onLeave={() => action('room:leave')} disabled={!connected || pending}>{ActiveMatch ? <ActiveMatch room={room} user={user} connected={connected} pending={pending} action={action} onTurn={turnSnake} invite={invite}/> : <div role="alert">暂不支持此游戏，请刷新页面或离开房间。<button onClick={() => action('room:leave')} disabled={!connected || pending}>离开房间</button></div>}</GameBoundary>}
    </>}</main><footer><span>同桌 <span className="footer-divider">/</span> 小游戏，大乐趣。</span><span>MADE FOR GOOD TIMES <span className="footer-dot">✳</span></span></footer></>;
}

createRoot(document.getElementById('root')).render(<App/>);
