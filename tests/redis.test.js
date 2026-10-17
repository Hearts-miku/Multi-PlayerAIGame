import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import Redis from 'ioredis';
import { io } from 'socket.io-client';
import { redisBackend } from '../server/redis-backend.js';
import { createApp, SOCKET_PATH } from '../server/app.js';

function event(socket, name, predicate = () => true) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { socket.off(name, listener); reject(new Error(`Timeout ${name}`)); }, 20_000);
    const listener = (value) => { if (predicate(value)) { clearTimeout(timer); socket.off(name, listener); resolve(value); } };
    socket.on(name, listener);
  });
}

test('real Redis: separate servers, atomic races, restart recovery and session revocation', { skip: !process.env.REDIS_URL, timeout: 120_000 }, async () => {
  const prefix = `test:${randomUUID()}:`, origin = 'http://localhost:5173';
  const first = redisBackend(process.env.REDIS_URL, prefix), second = redisBackend(process.env.REDIS_URL, prefix);
  const a = createApp({ backend: first, origins: [origin] }), b = createApp({ backend: second, origins: [origin] });
  const sockets = [];
  const admin = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1 });
  admin.on('error', () => {});
  let replacement;
  const start = async (app) => { await app.backend.ready; await new Promise((done) => app.httpServer.listen(0, '127.0.0.1', done)); return `http://127.0.0.1:${app.httpServer.address().port}`; };
  const request = async (base, path, body, cookie = '') => {
    const response = await fetch(`${base}/api/auth/${path}`, { method: body ? 'POST' : 'GET', headers: { Origin: origin, Cookie: cookie, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, data: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
  };
  const connect = async (base, cookie) => {
    const socket = io(base, { path: SOCKET_PATH, addTrailingSlash: false, transports: ['websocket'], autoConnect: false, reconnection: false, extraHeaders: { Origin: origin, Cookie: cookie } });
    sockets.push(socket); const ready = event(socket, 'room:update'); socket.connect(); await ready; return socket;
  };
  const emit = (socket, name, payload = {}) => socket.timeout(20_000).emitWithAck(name, payload);
  try {
    const [baseA, baseB] = await Promise.all([start(a), start(b)]);
    const [alpha, beta] = await Promise.all([
      request(baseA, 'register', { username: 'cloud_a', displayName: '云甲', password: 'cloud-test-password' }),
      request(baseB, 'register', { username: 'cloud_b', displayName: '云乙', password: 'cloud-test-password' }),
    ]);
    assert.equal(alpha.status, 200); assert.equal(beta.status, 200);
    assert.equal((await request(baseB, 'me', undefined, alpha.cookie)).data.user.id, alpha.data.user.id);
    const sa = await connect(baseA, alpha.cookie), sb = await connect(baseB, beta.cookie);
    const created = await emit(sa, 'room:create'); assert.equal(created.ok, true);
    const joined = event(sa, 'room:update', (room) => room?.status === 'playing');
    assert.equal((await emit(sb, 'room:join', { id: created.room.id })).ok, true); await joined;
    // Same identity on separate function instances must not get two moves in a turn.
    const race = await Promise.allSettled([first.games.move(alpha.data.user.id, 0, 0), second.games.move(alpha.data.user.id, 1, 0)]);
    assert.equal(race.filter((result) => result.status === 'fulfilled').length, 1);
    let room = await first.games.roomFor(alpha.data.user.id);
    assert.equal(room.moves.length, 1);
    const startX = room.moves[0].x;
    await first.publish({ type: 'room', id: room.id });
    for (let turn = 0; turn < 4; turn++) {
      const updated = event(sa, 'room:update', (r) => r?.moves.length === turn * 2 + 2);
      assert.equal((await emit(sb, 'game:move', { x: turn, y: 2 })).ok, true); await updated;
      const won = event(sb, 'room:update', (r) => r?.moves.length === turn * 2 + 3);
      assert.equal((await emit(sa, 'game:move', { x: startX + turn + 1, y: 0 })).ok, true); await won;
    }
    room = await second.games.get(room.id); assert.equal(room.winner, 1); assert.equal(room.moves.length, 9);
    // Shut down one instance and restore its player's board on a fresh instance.
    await a.close();
    replacement = createApp({ backend: redisBackend(process.env.REDIS_URL, prefix), origins: [origin] });
    const baseC = await start(replacement), sc = await connect(baseC, alpha.cookie);
    assert.equal((await replacement.games.roomFor(alpha.data.user.id)).winner, 1);
    assert.equal((await request(baseC, 'login', { username: 'cloud_a', password: 'cloud-test-password' })).status, 200);
    const expired = event(sc, 'session:expired');
    assert.equal((await request(baseB, 'logout', {}, alpha.cookie)).status, 200); await expired;
    assert.equal((await request(baseC, 'me', undefined, alpha.cookie)).status, 401);
    await emit(sb, 'room:leave'); assert.equal((await second.games.list()).length, 0);
    // Two simultaneous rooms for one user must produce only one membership.
    const roomRace = await Promise.allSettled([replacement.games.create(beta.data.user), second.games.create(beta.data.user)]);
    assert.equal(roomRace.filter((result) => result.status === 'fulfilled').length, 1);
    assert.equal((await second.games.list()).length, 1);
    assert.equal(await first.store.authenticate('invalid'), null);
  } finally {
    sockets.forEach((socket) => socket.disconnect());
    await b.close(); if (replacement) await replacement.close();
    if (a.httpServer.listening) await a.close();
    // Only this test's random namespace is deleted; never FLUSHDB or production keys.
    let cursor = '0';
    do { const result = await admin.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 100); cursor = result[0]; if (result[1].length) await admin.del(...result[1]); } while (cursor !== '0');
    admin.disconnect();
  }
});
