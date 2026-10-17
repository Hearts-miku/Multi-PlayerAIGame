import test from 'node:test';
import assert from 'node:assert/strict';
import { io } from 'socket.io-client';
import { createApp } from '../server/app.js';
import { createStore } from '../server/store.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const origin = 'http://localhost:5173';
const once = (socket, event) => new Promise((resolve, reject) => { const timeout = setTimeout(() => reject(new Error(`timeout: ${event}`)), 4000); socket.once(event, (data) => { clearTimeout(timeout); resolve(data); }); });

test('real HTTP and Socket.IO: auth, isolation, game, reconnect, logout revocation', async (t) => {
  const runtime = createApp({ databasePath: ':memory:', origins: [origin] });
  await new Promise((resolve) => runtime.httpServer.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${runtime.httpServer.address().port}`;
  const sockets = [];
  t.after(async () => { sockets.forEach((s) => s.disconnect()); await runtime.close(); });
  async function request(path, body, cookie = '', requestOrigin = origin) {
    const res = await fetch(`${base}/api/auth/${path}`, { method: body ? 'POST' : 'GET', headers: { Origin: requestOrigin, Cookie: cookie, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: res.status, cookie: res.headers.get('set-cookie'), data: await res.json() };
  }
  async function connect(cookie, allowed = true) {
    const socket = io(base, { autoConnect: false, path: '/api/server', addTrailingSlash: false, reconnection: false, transports: ['websocket'], extraHeaders: { Cookie: cookie, Origin: origin } }); sockets.push(socket);
    const ready = once(socket, allowed ? 'connect' : 'connect_error'); socket.connect(); await ready; return socket;
  }
  const emit = (s, name, payload = {}) => s.timeout(3000).emitWithAck(name, payload);
  assert.equal((await request('me')).status, 401);
  assert.equal((await request('register', { username: 'alpha', displayName: '甲', password: 'short' })).status, 400);
  assert.equal((await request('register', {}, '', 'https://evil.example')).status, 403);
  const a = await request('register', { username: 'alpha', displayName: '甲', password: 'password-12345' });
  assert.equal(a.status, 200); assert.match(a.cookie, /HttpOnly/); assert.match(a.cookie, /SameSite=Strict/); assert.ok(!JSON.stringify(a.data).includes('password'));
  const cookieA = a.cookie.split(';')[0];
  assert.equal((await request('register', { username: 'ALPHA', displayName: '重复', password: 'password-12345' })).status, 409);
  assert.equal((await request('login', { username: 'alpha', password: 'bad' })).status, 401);
  const login = await request('login', { username: 'ALPHA', password: 'password-12345' }); assert.equal(login.status, 200);
  const b = await request('register', { username: 'beta', displayName: '乙', password: 'password-12345' }), cookieB = b.cookie.split(';')[0];
  const outsider = await request('register', { username: 'gamma', displayName: '丙', password: 'password-12345' });
  await connect('', false);
  const sa = await connect(cookieA), sb = await connect(cookieB), sc = await connect(outsider.cookie.split(';')[0]);
  assert.equal((await emit(sc, 'game:move', { x: 0, y: 0 })).ok, false);
  const created = await emit(sa, 'room:create'); assert.equal(created.ok, true);
  const id = created.room.id;
  assert.equal((await emit(sb, 'room:join', { id })).ok, true);
  assert.equal((await emit(sc, 'room:join', { id })).ok, false);
  assert.equal((await emit(sb, 'game:move', { x: 0, y: 0 })).ok, false);
  let final;
  for (let x = 0; x < 5; x++) {
    final = await emit(sa, 'game:move', { x, y: 0 }); assert.equal(final.ok, true);
    if (x < 4) { assert.equal((await emit(sb, 'game:move', { x, y: 0 })).ok, false); assert.equal((await emit(sb, 'game:move', { x, y: 1 })).ok, true); }
  }
  assert.equal(final.room.winner, 1); assert.equal(final.room.moves.length, 9);
  sa.disconnect();
  const reconnected = io(base, { autoConnect: false, path: '/api/server', addTrailingSlash: false, reconnection: false, extraHeaders: { Cookie: cookieA, Origin: origin }, transports: ['websocket'] }); sockets.push(reconnected);
  const restored = once(reconnected, 'room:update'); reconnected.connect(); assert.equal((await restored).moves.length, 9);
  await emit(reconnected, 'game:rematch'); const rematch = await emit(sb, 'game:rematch'); assert.equal(rematch.room.status, 'playing'); assert.equal(rematch.room.players[0].color, 2);
  const expired = once(reconnected, 'session:expired'); assert.equal((await request('logout', {}, cookieA)).status, 200); await expired;
  assert.equal((await request('me', undefined, cookieA)).status, 401); await connect(cookieA, false);
  assert.equal((await request('me', undefined, cookieB)).status, 200);
  assert.equal((await emit(sb, 'room:leave')).ok, true); assert.equal(runtime.games.rooms.size, 0);
});

test('accounts and sessions persist after reopening SQLite; revocation persists', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'table-test-')), path = join(directory, 'test.sqlite');
  let store;
  try {
    store = createStore(path); const user = await store.register('persist', '持久玩家', 'password-12345'); const token = store.issue(user.id); store.close();
    store = createStore(path); assert.equal(store.authenticate(token).id, user.id); assert.equal((await store.login('persist', 'password-12345')).id, user.id);
    store.revoke(token); assert.equal(store.authenticate(token), undefined);
  } finally { store?.close(); rmSync(directory, { recursive: true, force: true }); }
});
