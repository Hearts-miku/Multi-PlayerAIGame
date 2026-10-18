import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import Redis from 'ioredis';
import { io } from 'socket.io-client';
import { redisBackend } from '../server/redis-backend.js';
import { createApp, SOCKET_PATH } from '../server/app.js';
import { COOKIE } from '../server/store.js';

function state(socket, predicate) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { socket.off('room:update', listener); reject(new Error('Cross-instance snake state timeout')); }, 20_000);
    function listener(room) { if (predicate(room)) { clearTimeout(timer); socket.off('room:update', listener); resolve(room); } }
    socket.on('room:update', listener);
  });
}

test('Redis snake: cross-instance frames, disconnect pause, atomic tick race and restart recovery', { skip: !process.env.REDIS_URL, timeout: 90_000 }, async () => {
  const prefix = `test:snake:${randomUUID()}:`, origin = 'http://localhost:5173';
  const first = redisBackend(process.env.REDIS_URL, prefix), second = redisBackend(process.env.REDIS_URL, prefix);
  const apps = [createApp({ backend: first, origins: [origin] }), createApp({ backend: second, origins: [origin] })], sockets = [];
  const admin = new Redis(process.env.REDIS_URL); admin.on('error', () => {});
  let replacement;
  const emit = (socket, name, payload = {}) => socket.timeout(15_000).emitWithAck(name, payload);
  try {
    await Promise.all(apps.map(async (app) => { await app.backend.ready; await new Promise((done) => app.httpServer.listen(0, '127.0.0.1', done)); }));
    const users = await Promise.all(['snake_a', 'snake_b'].map((name) => first.store.register(name, name, 'redis-test-password')));
    for (let i = 0; i < 2; i++) {
      const token = await first.store.issue(users[i].id), base = `http://127.0.0.1:${apps[i].httpServer.address().port}`;
      const socket = io(base, { path: SOCKET_PATH, addTrailingSlash: false, transports: ['websocket'], autoConnect: false, reconnection: false, extraHeaders: { Origin: origin, Cookie: `${COOKIE}=${token}` } });
      sockets.push(socket); const initial = state(socket, () => true); socket.connect(); await initial;
    }
    const boardUsers = await Promise.all(['board_a', 'board_b'].map((name) => first.store.register(name, name, 'redis-test-password')));
    const boardRoom = await first.games.create(boardUsers[0], { game: 'gomoku' });
    await second.games.join(boardUsers[1], boardRoom.id);
    await first.games.move(boardUsers[0].id, 0, 0);
    const savedBoard = await second.games.get(boardRoom.id);
    const [a, b] = sockets;
    const created = await emit(a, 'room:create', { game: 'snake', mode: 'versus' }); assert.equal(created.ok, true);
    const id = created.room.id;
    const savedSnake = await first.games.get(id);
    await assert.rejects(() => second.games.move(users[0].id, 1, 1), /不是五子棋/);
    await assert.rejects(() => second.games.readySnake(boardUsers[0].id, boardUsers.map((u) => u.id)), /不是贪食蛇/);
    assert.deepEqual(await first.games.get(id), savedSnake);
    assert.deepEqual(await second.games.get(boardRoom.id), savedBoard);
    assert.equal((await emit(b, 'room:join', { id })).ok, true);
    await emit(a, 'snake:ready'); assert.equal((await emit(b, 'snake:ready')).ok, true);
    assert.equal((await emit(a, 'snake:turn', { direction: 'up' })).ok, true);
    const frames = await Promise.all([state(a, (r) => r?.snake?.ticks === 1), state(b, (r) => r?.snake?.ticks === 1)]);
    assert.deepEqual(frames[0].snake.bodies, frames[1].snake.bodies);
    assert.deepEqual(frames[0].snake.bodies[0][0], [5, 5]);
    const paused = state(a, (r) => r?.snake?.phase === 'paused'); b.disconnect();
    const saved = await paused; assert.equal(saved.snake.phase, 'paused');
    await Promise.all(apps.map((app) => app.close()));
    replacement = redisBackend(process.env.REDIS_URL, prefix); await replacement.ready;
    assert.deepEqual((await replacement.games.get(id)).snake.bodies, saved.snake.bodies);
    const rival = redisBackend(process.env.REDIS_URL, prefix); await rival.ready;
    try {
      const online = users.map((u) => u.id);
      await replacement.games.readySnake(users[0].id, online); await rival.games.readySnake(users[1].id, online);
      const ready = await replacement.games.get(id);
      const results = await Promise.all([replacement.games.advance(id, ready.snake.nextTick, online), rival.games.advance(id, ready.snake.nextTick, online)]);
      assert.equal(results.filter(Boolean).length, 1);
      assert.equal((await rival.games.get(id)).snake.ticks, saved.snake.ticks + 1);
      await replacement.games.leave(users[0].id);
      assert.deepEqual(await rival.games.get(boardRoom.id), savedBoard);
      await rival.games.move(boardUsers[1].id, 0, 1);
      assert.equal((await replacement.games.get(boardRoom.id)).moves.length, 2);
      await replacement.games.leave(boardUsers[0].id);
    } finally { await rival.close(); }
  } finally {
    sockets.forEach((socket) => socket.disconnect());
    for (const app of apps) if (app.httpServer.listening) await app.close();
    if (replacement) await replacement.close();
    let cursor = '0';
    do { const result = await admin.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 100); cursor = result[0]; if (result[1].length) await admin.del(...result[1]); } while (cursor !== '0');
    admin.disconnect();
  }
});
