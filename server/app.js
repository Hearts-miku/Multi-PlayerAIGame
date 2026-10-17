import express from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { createStore, COOKIE, SESSION_AGE, sessionToken } from './store.js';
import { Games } from './game.js';

export function createApp({ databasePath = './data/game.sqlite', origins = ['http://localhost:3000', 'http://localhost:5173'], secure = false, trustProxy = 0 } = {}) {
  const store = createStore(databasePath), games = new Games();
  const app = express(), httpServer = createServer(app);
  app.disable('x-powered-by');
  if (trustProxy) app.set('trust proxy', trustProxy);
  app.use(helmet({ contentSecurityPolicy: { directives: { 'upgrade-insecure-requests': secure ? [] : null } }, strictTransportSecurity: secure ? undefined : false }));
  app.use(express.json({ limit: '8kb' }));
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (!['GET', 'HEAD'].includes(req.method) && (!origins.includes(req.headers.origin) || !req.is('application/json'))) return res.status(403).json({ error: '请求来源不受信任' });
    next();
  });
  const authLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: '尝试次数过多，请 15 分钟后重试' } });
  const cookieOptions = { httpOnly: true, secure, sameSite: 'strict', path: '/' };
  const signIn = (res, user) => { res.cookie(COOKIE, store.issue(user.id), { ...cookieOptions, maxAge: SESSION_AGE }); return res.json({ user }); };
  function revoke(req) {
    const token = sessionToken(req.headers.cookie);
    store.revoke(token);
    for (const socket of io.sockets.sockets.values()) if (socket.data.token === token) { socket.emit('session:expired'); socket.disconnect(true); }
  }
  app.post('/api/auth/register', authLimit, async (req, res) => {
    const { username, displayName, password } = req.body || {};
    if (typeof username !== 'string' || !/^[a-zA-Z0-9_]{3,24}$/.test(username) || typeof displayName !== 'string' || !displayName.trim() || displayName.trim().length > 20 || /[\u0000-\u001f\u007f]/.test(displayName) || typeof password !== 'string' || password.length < 10 || password.length > 128) return res.status(400).json({ error: '账号需 3–24 位字母、数字或下划线；昵称 1–20 字；密码 10–128 位' });
    try {
      const user = await store.register(username.toLowerCase(), displayName.trim(), password);
      revoke(req); signIn(res, user);
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
    revoke(req); signIn(res, user);
  });
  app.get('/api/auth/me', (req, res) => {
    const user = store.authenticate(sessionToken(req.headers.cookie));
    res.status(user ? 200 : 401).json(user ? { user } : { error: '请先登录' });
  });
  app.post('/api/auth/logout', (req, res) => { revoke(req); res.clearCookie(COOKIE, cookieOptions); res.json({ ok: true }); });
  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api', (_req, res) => res.status(404).json({ error: '接口不存在' }));
  // Same-origin polling GETs may omit Origin; verify Host and Fetch Metadata too.
  const allowedHosts = origins.map((origin) => new URL(origin).host);
  const io = new Server(httpServer, { maxHttpBufferSize: 8192, allowRequest: (req, done) => done(null,
    req.headers.origin ? origins.includes(req.headers.origin) : allowedHosts.includes(req.headers.host) && req.headers['sec-fetch-site'] !== 'cross-site'
  ) });
  const isOnline = (id) => [...io.sockets.sockets.values()].some((s) => s.data.user.id === id);
  const snapshot = (room) => ({ ...room, players: room.players.map(({ id, displayName, color }) => ({ id, displayName, color, online: isOnline(id) })) });
  const broadcast = () => {
    io.emit('lobby:update', { online: new Set([...io.sockets.sockets.values()].map((s) => s.data.user.id)).size, rooms: [...games.rooms.values()].map((r) => ({ id: r.id, host: r.players[0].displayName, count: r.players.length, status: r.status })) });
    for (const room of games.rooms.values()) for (const player of room.players) io.to(`user:${player.id}`).emit('room:update', snapshot(room));
  };
  io.use((socket, next) => {
    const token = sessionToken(socket.request.headers.cookie), user = store.authenticate(token);
    if (!user) return next(new Error('请先登录'));
    if ([...io.sockets.sockets.values()].filter((s) => s.data.user.id === user.id).length >= 5) return next(new Error('同一账号最多打开 5 个连接'));
    socket.data = { user, token }; next();
  });
  io.on('connection', (socket) => {
    const user = socket.data.user;
    socket.join(`user:${user.id}`);
    let count = 0, windowStart = Date.now();
    socket.use((_packet, next) => {
      if (!store.authenticate(socket.data.token)) { socket.emit('session:expired'); socket.disconnect(true); return; }
      if (Date.now() - windowStart > 1000) { count = 0; windowStart = Date.now(); }
      if (++count > 20) { socket.emit('notice', '操作太快了，请稍后重试'); return; }
      next();
    });
    const action = (name, fn) => socket.on(name, (payload, ack) => {
      try { const room = fn(payload || {}); broadcast(); if (typeof ack === 'function') ack({ ok: true, room: room && snapshot(room) }); }
      catch (error) { if (typeof ack === 'function') ack({ ok: false, error: error.message }); }
    });
    action('room:create', () => games.create(user));
    action('room:join', ({ id }) => games.join(user, id));
    action('game:move', ({ x, y }) => games.move(user.id, x, y));
    action('game:resign', () => games.resign(user.id));
    action('game:rematch', () => games.rematch(user.id));
    action('room:leave', () => {
      const room = games.leave(user.id);
      for (const player of room.players) io.to(`user:${player.id}`).emit('room:closed', '房间已关闭，可以开始新的对局');
    });
    socket.emit('room:update', games.roomFor(user.id) ? snapshot(games.roomFor(user.id)) : null);
    broadcast(); socket.on('disconnect', broadcast);
  });
  const maintenance = setInterval(() => {
    store.prune();
    for (const socket of io.sockets.sockets.values()) if (!store.authenticate(socket.data.token)) { socket.emit('session:expired'); socket.disconnect(true); }
    for (const [id, room] of games.rooms) if (Date.now() - room.updatedAt > 60 * 60 * 1000 && room.players.every((p) => !isOnline(p.id))) games.rooms.delete(id);
    broadcast();
  }, 60_000);
  maintenance.unref();
  if (existsSync(resolve('dist/index.html'))) {
    app.use(express.static(resolve('dist')));
    app.get('/{*path}', (_req, res) => res.sendFile(resolve('dist/index.html')));
  }
  app.use((error, _req, res, _next) => { console.error(error.message); res.status(error.status || 500).json({ error: error.status === 400 ? '请求格式不正确' : '服务暂时不可用，请稍后重试' }); });
  return { app, httpServer, io, games, store, close: async () => { clearInterval(maintenance); await new Promise((done) => io.close(done)); store.close(); } };
}
