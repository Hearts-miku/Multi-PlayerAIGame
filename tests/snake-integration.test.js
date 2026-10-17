import test from 'node:test';
import assert from 'node:assert/strict';
import { io } from 'socket.io-client';
import { createApp, SOCKET_PATH } from '../server/app.js';
import { COOKIE } from '../server/store.js';

function event(socket, predicate) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { socket.off('room:update', listener); reject(new Error('Snake state timeout')); }, 10_000);
    function listener(room) { if (predicate(room)) { clearTimeout(timer); socket.off('room:update', listener); resolve(room); } }
    socket.on('room:update', listener);
  });
}

test('snake socket flow: server frames, outsider rejection, disconnect pause, resume and team victory', { timeout: 30_000 }, async () => {
  const origin = 'http://localhost:5173', app = createApp({ databasePath: ':memory:', origins: [origin] }), sockets = [];
  await new Promise((done) => app.httpServer.listen(0, '127.0.0.1', done));
  const base = `http://127.0.0.1:${app.httpServer.address().port}`;
  const users = [];
  async function connect(user) {
    const socket = io(base, { path: SOCKET_PATH, addTrailingSlash: false, transports: ['websocket'], autoConnect: false, reconnection: false, extraHeaders: { Origin: origin, Cookie: `${COOKIE}=${app.store.issue(user.id)}` } });
    sockets.push(socket); const ready = event(socket, () => true); socket.connect(); await ready; return socket;
  }
  const emit = (socket, name, payload = {}) => socket.timeout(4000).emitWithAck(name, payload);
  try {
    for (const username of ['snake_a', 'snake_b', 'snake_outside']) users.push(await app.store.register(username, username, 'test-password-123'));
    const a = await connect(users[0]), b = await connect(users[1]), outsider = await connect(users[2]);
    const created = await emit(a, 'room:create', { game: 'snake', mode: 'coop' }); assert.equal(created.ok, true);
    await emit(b, 'room:join', { id: created.room.id });
    assert.equal((await emit(outsider, 'snake:turn', { direction: 'up' })).ok, false);
    assert.equal((await emit(a, 'snake:ready')).ok, true); assert.equal((await emit(b, 'snake:ready')).ok, true);
    await event(a, (r) => r?.snake?.ticks >= 1);
    const paused = event(a, (r) => r?.snake?.phase === 'paused'); b.disconnect();
    const saved = await paused, replacement = await connect(users[1]);
    assert.deepEqual(app.games.get(saved.id).snake.bodies, saved.snake.bodies);
    assert.equal((await emit(a, 'snake:ready')).ok, true); assert.equal((await emit(replacement, 'snake:ready')).ok, true);
    // A server-side fixture near the target verifies that normal timed movement
    // and food collection publish a shared victory, never a client-set score.
    const room = app.games.get(saved.id); room.snake.scores = [9, 9];
    const wonA = event(a, (r) => r?.reason === 'team-goal'), wonB = event(replacement, (r) => r?.reason === 'team-goal');
    const victories = await Promise.all([wonA, wonB]);
    assert.deepEqual(victories[0].snake.scores, [10, 10]); assert.equal(victories[1].status, 'finished');
    assert.equal((await emit(a, 'game:rematch')).ok, true);
    const replay = await emit(replacement, 'game:rematch'); assert.equal(replay.room.snake.phase, 'ready');
    await emit(a, 'room:leave');
  } finally { sockets.forEach((s) => s.disconnect()); await app.close(); }
});
