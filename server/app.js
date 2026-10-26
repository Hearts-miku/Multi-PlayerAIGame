import express from 'express';
import helmet from 'helmet';
import { ipKeyGenerator } from 'express-rate-limit';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { COOKIE, SESSION_AGE, sessionToken, digest } from './store.js';
import { localBackend } from './backend.js';

export const SOCKET_PATH = '/api/server';
export function createApp({ databasePath = './data/game.sqlite', origins = ['http://localhost:3000', 'http://localhost:5173'], secure = false, trustProxy = 0, backend = localBackend(databasePath) } = {}) {
  const { store, games } = backend;
  const app = express(), httpServer = createServer(app);
  app.disable('x-powered-by');
  if (trustProxy) app.set('trust proxy', trustProxy);
  app.use(helmet({ contentSecurityPolicy: { directives: { 'upgrade-insecure-requests': secure ? [] : null } }, strictTransportSecurity: secure ? undefined : false }));
  app.use(express.json({ limit: '8kb' }));
  app.use('/api', async (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (!['GET', 'HEAD'].includes(req.method) && (!origins.includes(req.headers.origin) || !req.is('application/json'))) return res.status(403).json({ error: '请求来源不受信任' });
    await backend.ready; next();
  });
  const authLimit = async (req, res, next) => {
    if (!await backend.limit(`auth:${ipKeyGenerator(req.ip)}`, 30, 15 * 60_000)) return res.status(429).set('Retry-After', '900').json({ error: '尝试次数过多，请 15 分钟后重试' });
    next();
  };
  const cookieOptions = { httpOnly: true, secure, sameSite: 'strict', path: '/' };
  const signIn = async (res, user) => {
    res.cookie(COOKIE, await store.issue(user.id), { ...cookieOptions, maxAge: SESSION_AGE });
    return res.json({ user });
  };
  async function revoke(req) {
    const token = sessionToken(req.headers.cookie);
    await store.revoke(token);
    if (token) await backend.publish({ type: 'revoke', tokenHash: digest(token) });
  }
  app.post('/api/auth/register', authLimit, async (req, res) => {
    const { username, displayName, password } = req.body || {};
    if (typeof username !== 'string' || !/^[a-zA-Z0-9_]{3,24}$/.test(username) || typeof displayName !== 'string' || !displayName.trim() || displayName.trim().length > 20 || /[\u0000-\u001f\u007f]/.test(displayName) || typeof password !== 'string' || password.length < 10 || password.length > 128) return res.status(400).json({ error: '账号需 3–24 位字母、数字或下划线；昵称 1–20 字；密码 10–128 位' });
    try {
      const user = await store.register(username.toLowerCase(), displayName.trim(), password);
      await revoke(req); await signIn(res, user);
    } catch (error) {
      if (String(error.message).includes('UNIQUE')) return res.status(409).json({ error: '这个账号已经被使用了' });
      throw error;
    }
  });
  app.post('/api/auth/login', authLimit, async (req, res) => {
    const { username, password } = req.body || {};
    if (typeof username !== 'string' || username.length > 24 || typeof password !== 'string' || password.length > 128) return res.status(400).json({ error: '请填写正确的账号和密码' });
    const user = await store.login(username.toLowerCase(), password);
    if (!user) return res.status(401).json({ error: '账号或密码不正确' });
    await revoke(req); await signIn(res, user);
  });
  app.get('/api/auth/me', async (req, res) => {
    const user = await store.authenticate(sessionToken(req.headers.cookie));
    res.status(user ? 200 : 401).json(user ? { user } : { error: '请先登录' });
  });
  app.post('/api/auth/logout', async (req, res) => { await revoke(req); res.clearCookie(COOKIE, cookieOptions); res.json({ ok: true }); });
  app.get('/api/health', (_req, res) => res.json({ ok: true, storage: backend.kind }));
  app.use('/api', (_req, res) => res.status(404).json({ error: '接口不存在' }));
  const allowedHosts = origins.map((origin) => new URL(origin).host);
  const io = new Server(httpServer, { path: SOCKET_PATH, addTrailingSlash: false, transports: ['websocket'], maxHttpBufferSize: 8192, allowRequest: (req, done) => done(null,
    req.headers.origin ? origins.includes(req.headers.origin) : allowedHosts.includes(req.headers.host) && req.headers['sec-fetch-site'] !== 'cross-site'
  ) });
  const snapshot = (room, online) => room && ({ ...room, players: room.players.map(({ id, displayName, color }) => ({ id, displayName, color, online: online.includes(String(id)) || online.includes(id) })) });
  let delivery = Promise.resolve(), closing = false;
  let onlinePlayers = [];
  const snakeRooms = new Map(), ticking = new Set();
  function remember(room) {
    if (room?.game !== 'snake') return;
    const previous = snakeRooms.get(room.id);
    if (previous && (previous.revision || 0) > (room.revision || 0)) return false;
    snakeRooms.set(room.id, room);
    return true;
  }
  const broadcast = async (event) => {
    if (closing) return;
    if (event.type === 'revoke') {
      for (const socket of io.sockets.sockets.values()) if (digest(socket.data.token) === event.tokenHash) { socket.emit('session:expired'); socket.disconnect(true); }
      return;
    }
    if (event.type === 'closed') {
      snakeRooms.delete(event.id);
      for (const id of event.players) if (!await games.roomFor(id)) io.to(`user:${id}`).emit('room:closed', '房间已关闭，可以开始新的对局');
    }
    if (io.sockets.sockets.size === 0) return;
    const online = event.frame ? onlinePlayers : await backend.presence();
    onlinePlayers = online;
    if (event.type === 'room') {
      const room = event.room || await games.get(event.id);
      if (remember(room) === false) return;
      if (room) for (const player of room.players) io.to(`user:${player.id}`).emit('room:update', snapshot(room, online));
    }
    if (event.lobby) {
      const rooms = await games.list();
      io.emit('lobby:update', { online: online.length, rooms: rooms.map((r) => ({ id: r.id, host: r.players[0].displayName, count: r.players.length, status: r.status, game: r.game || 'gomoku', mode: r.mode || 'versus' })) });
      if (event.type === 'presence') for (const room of rooms) {
        if (remember(room) === false) continue;
        for (const player of room.players) io.to(`user:${player.id}`).emit('room:update', snapshot(room, online));
      }
    }
  };
  const unsubscribe = backend.listen((event) => {
    delivery = delivery.then(() => broadcast(event)).catch(() => console.error('Realtime synchronization failed'));
    return delivery;
  });
  io.use(async (socket, next) => {
    try {
      await backend.ready;
      const token = sessionToken(socket.request.headers.cookie), user = await store.authenticate(token);
      if (!user) return next(new Error('请先登录'));
      if (!await backend.limit(`connect:${user.id}`, 30, 60_000)) return next(new Error('连接次数过多，请稍后重试'));
      socket.data = { user, token }; next();
    } catch { next(new Error('服务暂时不可用')); }
  });
  io.on('connection', (socket) => {
    const user = socket.data.user;
    socket.join(`user:${user.id}`);
    let queue = Promise.resolve();
    const initialized = (async () => {
      const online = await backend.presence([[socket.id, user.id]]);
      onlinePlayers = online;
      if (!socket.connected) { await backend.presence([], [socket.id]); return; }
      const room = await games.roomFor(user.id); remember(room);
      socket.emit('room:update', snapshot(room, online) || null);
      await backend.publish({ type: 'presence', lobby: true });
    })();
    initialized.catch(() => socket.disconnect(true));
    const action = (name, fn) => socket.on(name, (payload, ack) => {
      queue = queue.then(async () => {
        try {
          await initialized;
          if (!await store.authenticate(socket.data.token)) { socket.emit('session:expired'); socket.disconnect(true); return; }
          if (!await backend.limit(`action:${user.id}`, 20, 1000)) throw new Error('操作太快了，请稍后重试');
          const room = await fn(payload || {});
          remember(room);
          if (name === 'snake:turn') { if (typeof ack === 'function') ack({ ok: true }); return; }
          if (name === 'room:leave') await backend.publish({ type: 'closed', id: room.id, players: room.players.map((p) => p.id), lobby: true });
          else await backend.publish({ type: 'room', id: room.id, ...(room.game === 'snake' ? { room } : {}), lobby: (name !== 'game:move' && name !== 'sokoban:action' && name !== 'lights:action' && name !== 'gravity:action') || room.status === 'finished' });
          if (typeof ack === 'function') ack({ ok: true, room: name === 'room:leave' ? null : snapshot(room, await backend.presence()) });
        } catch (error) {
          const message = /[\u3400-\u9fff]/.test(error.message) ? error.message : '服务暂时不可用，请稍后重试';
          if (typeof ack === 'function') ack({ ok: false, error: message });
        }
      }).catch(() => console.error('Realtime operation failed'));
    });
    action('room:create', ({ game, mode, startLevel }) => games.create(user, { game, mode, startLevel }));
    action('room:join', ({ id }) => games.join(user, id));
    action('game:move', ({ x, y }) => games.move(user.id, x, y));
    action('game:resign', () => games.resign(user.id));
    action('game:rematch', () => games.rematch(user.id));
    action('room:leave', () => games.leave(user.id));
    action('lights:action', async (command) => games.lightsAction(user.id, command, await backend.presence()));
    action('gravity:action', async (command) => games.gravityAction(user.id, command, await backend.presence()));
    action('sokoban:action', async (command) => games.sokobanAction(user.id, command, await backend.presence()));
    action('snake:ready', async () => games.readySnake(user.id, await backend.presence()));
    action('snake:turn', ({ direction }) => games.turnSnake(user.id, direction));
    socket.on('disconnect', () => {
      if (!closing) backend.presence([], [socket.id]).then(() => backend.publish({ type: 'presence', lobby: true })).catch(() => console.error('Presence update failed'));
    });
  });
  // Timers only advance rooms with a participant connected to this instance.
  // Redis compares the entire prior snapshot, so concurrent instances can
  // commit each due frame at most once. No client can submit a tick or board.
  const snakeTimer = setInterval(() => {
    if (closing) return;
    const localUsers = new Set([...io.sockets.sockets.values()].map((s) => s.data.user.id));
    for (const [id, cached] of snakeRooms) {
      if (!cached.players.some((p) => localUsers.has(p.id))) { snakeRooms.delete(id); continue; }
      if (cached.status !== 'playing' || cached.snake.phase !== 'running' || ticking.has(id)) continue;
      if (Date.now() < cached.snake.nextTick && cached.players.every((p) => onlinePlayers.includes(p.id))) continue;
      ticking.add(id);
      (async () => {
        const room = await games.advance(id, Date.now(), onlinePlayers);
        if (closing) return;
        if (room) {
          remember(room);
          await backend.publish({ type: 'room', id, room, frame: true, lobby: room.status === 'finished' });
        } else {
          const latest = await games.get(id);
          if (latest) remember(latest); else snakeRooms.delete(id);
        }
      })().catch(() => { snakeRooms.delete(id); console.error('Snake synchronization failed'); })
        .finally(() => ticking.delete(id));
    }
  }, 100);
  snakeTimer.unref();
  let maintaining = false;
  const maintenance = setInterval(async () => {
    if (closing || maintaining || !io.sockets.sockets.size) return;
    maintaining = true;
    try {
      await store.prune();
      for (const socket of io.sockets.sockets.values()) if (!await store.authenticate(socket.data.token)) { socket.emit('session:expired'); socket.disconnect(true); }
      await backend.presence([...io.sockets.sockets.values()].map((s) => [s.id, s.data.user.id]));
      await broadcast({ type: 'presence', lobby: true });
    } catch { console.error('Realtime maintenance failed'); }
    finally { maintaining = false; }
  }, 45_000);
  maintenance.unref();
  if (existsSync(resolve('dist/index.html'))) {
    app.use(express.static(resolve('dist')));
    app.get('/{*path}', (_req, res) => res.sendFile(resolve('dist/index.html')));
  }
  app.use((error, _req, res, _next) => {
    // Parser errors can contain request bodies (including passwords).
    console.error('HTTP request failed', error.status || 500, error.name, error.code || (error.message === 'Command timed out' ? 'REDIS_COMMAND_TIMEOUT' : 'UNEXPECTED_ERROR'));
    res.status(error.status || 500).json({ error: error.status === 400 ? '请求格式不正确' : '服务暂时不可用，请稍后重试' });
  });
  return { app, httpServer, io, games, store, backend, close: async () => {
    closing = true; clearInterval(maintenance); clearInterval(snakeTimer); unsubscribe();
    const ids = [...io.sockets.sockets.keys()];
    await new Promise((done) => io.close(done));
    await delivery;
    if (ids.length) await backend.presence([], ids).catch(() => {});
    await backend.close();
  } };
}
