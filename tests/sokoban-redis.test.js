import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import Redis from 'ioredis';
import { io } from 'socket.io-client';
import { redisBackend } from '../server/redis-backend.js';
import { createApp, SOCKET_PATH } from '../server/app.js';
import { COOKIE } from '../server/store.js';
import { newSokoban } from '../server/sokoban.js';

function state(socket, predicate) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { socket.off('room:update', listener); reject(new Error('Cross-instance snake state timeout')); }, 20_000);
    function listener(room) { if (predicate(room)) { clearTimeout(timer); socket.off('room:update', listener); resolve(room); } }
    socket.on('room:update', listener);
  });
}

test('Redis puzzle: authenticated cross-instance moves, atomic races and restart recovery', { skip: !process.env.REDIS_URL, timeout: 90_000 }, async () => {
  const prefix = `test:sokoban:${randomUUID()}:`, origin = 'http://localhost:5173';
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
    const [a,b] = sockets;
    const created = await emit(a, 'room:create', {game:'sokoban',mode:'coop'}); assert.equal(created.ok,true);
    const id=created.room.id; assert.equal((await emit(b,'room:join',{id})).ok,true);
    const command={kind:'move',direction:'up',round:0,revision:0};
    const synced=state(b,r=>r?.sokoban?.revision===1);
    assert.equal((await emit(a,'sokoban:action',command)).ok,true);
    assert.deepEqual((await synced).sokoban.boxes[0],[2,2]);
    const before=await first.games.get(id);
    assert.equal((await emit(b,'sokoban:action',command)).ok,false);
    const next={...command,revision:1};
    const online=users.map(u=>u.id);
    const results=await Promise.allSettled([first.games.sokobanAction(users[1].id,next,online),second.games.sokobanAction(users[1].id,next,online)]);
    assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
    let saved=await first.games.get(id); assert.equal(saved.sokoban.moves,before.sokoban.moves+1);
    // Seed only this random test namespace near the new two-player latch.
    saved.sokoban=newSokoban(5);saved.sokoban.actors=[[2,2],[3,5]];saved.revision++;
    await admin.set(`${prefix}room:${id}`,JSON.stringify(saved),'KEEPTTL');
    const unlocked=state(a,r=>r?.sokoban?.latches?.includes('A'));
    assert.equal((await emit(b,'sokoban:action',{kind:'move',direction:'down',round:0,revision:0})).ok,true);
    assert.deepEqual((await unlocked).sokoban.latches,['A']);
    saved=await first.games.get(id);
    await Promise.all(apps.map(app=>app.close()));
    replacement=redisBackend(process.env.REDIS_URL,prefix);await replacement.ready;
    assert.deepEqual((await replacement.games.get(id)).sokoban,saved.sokoban);
    await replacement.games.sokobanAction(users[1].id,{kind:'undo',round:0,revision:1},online);
    assert.deepEqual((await replacement.games.get(id)).sokoban.latches,[]);
    await assert.rejects(()=>replacement.games.sokobanAction(users[0].id,{...command,revision:2},[users[0].id]),/上线/);
    await replacement.games.leave(users[0].id);
    for(const startLevel of [7,10]) {
      const selected=await replacement.games.create(users[0],{game:'sokoban',mode:'coop',startLevel});
      await replacement.close();replacement=redisBackend(process.env.REDIS_URL,prefix);await replacement.ready;
      const joined=await replacement.games.join(users[1],selected.id);
      assert.equal(joined.sokoban.level,startLevel);assert.deepEqual(joined.sokoban.circuits,newSokoban(startLevel).circuits);
      await replacement.games.leave(users[0].id);
    }
  } finally {
    sockets.forEach((socket) => socket.disconnect());
    for (const app of apps) if (app.httpServer.listening) await app.close();
    if (replacement) await replacement.close();
    let cursor = '0';
    do { const result = await admin.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 100); cursor = result[0]; if (result[1].length) await admin.del(...result[1]); } while (cursor !== '0');
    admin.disconnect();
  }
});
