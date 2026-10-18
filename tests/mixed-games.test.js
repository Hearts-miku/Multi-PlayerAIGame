import test from 'node:test';
import assert from 'node:assert/strict';
import { io } from 'socket.io-client';
import { createApp, SOCKET_PATH } from '../server/app.js';
import { COOKIE } from '../server/store.js';

function state(socket, predicate) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { socket.off('room:update', listener); reject(new Error('Mixed-game state timeout')); }, 10000);
    function listener(room) { if (predicate(room)) { clearTimeout(timer); socket.off('room:update', listener); resolve(room); } }
    socket.on('room:update', listener);
  });
}

test('simultaneous Socket.IO games reject cross-game commands and isolate broadcasts and closure', { timeout: 30000 }, async () => {
  const origin = 'http://localhost:5173', app = createApp({ databasePath: ':memory:', origins: [origin] });
  const sockets = [], seen = [[], [], [], []], users = [];
  const emit = (i, event, payload = {}) => sockets[i].timeout(5000).emitWithAck(event, payload);
  try {
    await new Promise((resolve) => app.httpServer.listen(0, '127.0.0.1', resolve));
    for (let i = 0; i < 4; i++) {
      const user = await app.store.register(`mixed_${i}`, `Mixed ${i}`, 'mixed-password-123'); users.push(user);
      const socket = io(`http://127.0.0.1:${app.httpServer.address().port}`, { path: SOCKET_PATH, addTrailingSlash: false, transports: ['websocket'], autoConnect: false, reconnection: false, extraHeaders: { Origin: origin, Cookie: `${COOKIE}=${app.store.issue(user.id)}` } });
      sockets.push(socket); socket.on('room:update', (room) => { if (room) seen[i].push(room.id); });
      const ready = state(socket, () => true); socket.connect(); await ready;
    }
    const g = await emit(0, 'room:create', { game: 'gomoku' }); assert.equal(g.ok, true);
    assert.equal((await emit(1, 'room:join', { id: g.room.id })).ok, true);
    const s = await emit(2, 'room:create', { game: 'snake', mode: 'coop' }); assert.equal(s.ok, true);
    assert.equal((await emit(3, 'room:join', { id: s.room.id })).ok, true);
    const before = structuredClone(app.games.list());
    assert.equal((await emit(0, 'snake:ready')).ok, false);
    assert.equal((await emit(2, 'game:move', { x: 0, y: 0 })).ok, false);
    assert.equal((await emit(0, 'room:join', { id: s.room.id })).ok, false);
    assert.deepEqual(app.games.list(), before);
    const received = state(sockets[1], (room) => room?.id === g.room.id && room.moves.length === 1);
    assert.equal((await emit(0, 'game:move', { x: 0, y: 0 })).ok, true); await received;
    const board = structuredClone(app.games.get(g.room.id));
    await emit(2, 'snake:ready'); await emit(3, 'snake:ready');
    await state(sockets[2], (room) => room?.id === s.room.id && room.snake.ticks > 0);
    assert.deepEqual(app.games.get(g.room.id), board);
    assert.equal((await emit(2, 'room:leave')).ok, true);
    assert.deepEqual(app.games.get(g.room.id), board);
    assert.equal((await emit(1, 'game:move', { x: 0, y: 1 })).ok, true);
    for (let i = 0; i < 4; i++) assert.deepEqual([...new Set(seen[i])], [i < 2 ? g.room.id : s.room.id]);
  } finally { sockets.forEach((socket) => socket.disconnect()); await app.close(); }
});
