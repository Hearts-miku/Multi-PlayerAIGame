import Redis from 'ioredis';
import { randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { digest, SESSION_AGE } from './store.js';
import { Games } from './game.js';

const derive = promisify(scrypt);
const ROOM_SECONDS = 24 * 60 * 60;
const parse = (value) => value ? JSON.parse(value) : null;
const publicUser = ({ id, username, displayName }) => ({ id, username, displayName });

// Commit room, membership and expiry atomically. An overlapping move/leave cannot
// overwrite a newer board: the caller must recompute against the latest snapshot.
const COMMIT = `
local current = redis.call('GET', KEYS[1]) or ''
if current ~= ARGV[1] then return 0 end
local membership = redis.call('GET', KEYS[3])
if membership and membership ~= ARGV[3] then return -2 end
if ARGV[5] == 'create' then
  redis.call('ZREMRANGEBYSCORE', KEYS[2], '-inf', ARGV[6])
  if redis.call('ZCARD', KEYS[2]) >= 500 then return -3 end
elseif ARGV[5] ~= 'join' and membership ~= ARGV[3] then return -4 end
if ARGV[5] == 'leave' then
  redis.call('DEL', KEYS[1])
  redis.call('ZREM', KEYS[2], ARGV[3])
  for i=3,#KEYS do
    if redis.call('GET', KEYS[i]) == ARGV[3] then redis.call('DEL', KEYS[i]) end
  end
else
  redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[4])
  redis.call('ZADD', KEYS[2], tonumber(ARGV[6]) + tonumber(ARGV[4])*1000, ARGV[3])
  for i=3,#KEYS do redis.call('SET', KEYS[i], ARGV[3], 'EX', ARGV[4]) end
end
return 1`;

const PRESENCE = `
local expired = redis.call('ZRANGEBYSCORE', KEYS[1], '-inf', ARGV[1])
for _,id in ipairs(expired) do redis.call('HDEL', KEYS[2], id) end
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', ARGV[1])
local changes = cjson.decode(ARGV[2])
for _,pair in ipairs(changes.touch) do
  redis.call('ZADD', KEYS[1], tonumber(ARGV[1])+120000, pair[1])
  redis.call('HSET', KEYS[2], pair[1], pair[2])
end
for _,id in ipairs(changes.remove) do
  redis.call('ZREM', KEYS[1], id)
  redis.call('HDEL', KEYS[2], id)
end
redis.call('EXPIRE', KEYS[1], 180)
redis.call('EXPIRE', KEYS[2], 180)
return redis.call('HVALS', KEYS[2])`;

export function redisBackend(url, prefix = 'tongzhuo:v1:') {
  if (!url || !url.startsWith('rediss://')) throw new Error('Redis requires a TLS REDIS_URL');
  if (!/^[a-zA-Z0-9:_-]{1,100}$/.test(prefix)) throw new Error('Invalid Redis namespace');
  const redis = new Redis(url, { lazyConnect: true, connectTimeout: 10_000, commandTimeout: 12_000, maxRetriesPerRequest: 1, retryStrategy: (attempt) => Math.min(attempt * 500, 5000) });
  const subscriber = redis.duplicate();
  for (const client of [redis, subscriber]) client.on('error', (error) => console.error('Redis connection temporarily unavailable', error.code || error.name));
  const key = (part) => `${prefix}${part}`, channel = key('events');
  const listeners = new Set();
  subscriber.on('message', (_channel, message) => {
    try { const event = JSON.parse(message); for (const fn of listeners) Promise.resolve(fn(event)).catch(() => console.error('Realtime delivery failed')); }
    catch { console.error('Invalid realtime event'); }
  });
  // Vercel may freeze a prewarmed instance before its first request. Start I/O
  // during a request, and let later requests retry a failed initial connection.
  let initialization;
  function ready() {
    if (!initialization) initialization = (async () => {
      await redis.ping();
      await subscriber.subscribe(channel);
    })().catch((error) => { initialization = undefined; throw error; });
    return initialization;
  }
  const store = {
    async register(username, displayName, password) {
      const user = { id: randomUUID(), username, displayName, salt: randomBytes(16).toString('hex') };
      user.passwordHash = (await derive(password, user.salt, 64)).toString('hex');
      const result = await redis.eval(`if redis.call('EXISTS',KEYS[1]) == 1 then return 0 end
        redis.call('SET',KEYS[1],ARGV[1]); redis.call('SET',KEYS[2],ARGV[1]); return 1`, 2, key(`username:${username}`), key(`user:${user.id}`), JSON.stringify(user));
      if (!result) throw new Error('UNIQUE username');
      return publicUser(user);
    },
    async login(username, password) {
      const user = parse(await redis.get(key(`username:${username}`)));
      const hash = await derive(password, user?.salt || 'nonexistent-user-padding', 64);
      const expected = user ? Buffer.from(user.passwordHash, 'hex') : Buffer.alloc(64);
      return timingSafeEqual(hash, expected) && user ? publicUser(user) : null;
    },
    async issue(id) {
      const user = parse(await redis.get(key(`user:${id}`)));
      if (!user) throw new Error('User not found');
      const token = randomBytes(32).toString('hex');
      await redis.set(key(`session:${digest(token)}`), JSON.stringify(publicUser(user)), 'EX', SESSION_AGE / 1000);
      return token;
    },
    async authenticate(token) {
      if (!/^[a-f0-9]{64}$/.test(token)) return null;
      return parse(await redis.get(key(`session:${digest(token)}`)));
    },
    async revoke(token) { if (token) await redis.del(key(`session:${digest(token)}`)); },
    prune() {},
  };
  const games = {
    async get(id) { return parse(await redis.get(key(`room:${id}`))) || undefined; },
    async roomFor(id) { const roomId = await redis.get(key(`member:${id}`)); return roomId ? this.get(roomId) : undefined; },
    async list() {
      const ids = await redis.zrangebyscore(key('rooms'), Date.now(), '+inf');
      return ids.length ? (await redis.mget(...ids.map((id) => key(`room:${id}`)))).map(parse).filter(Boolean) : [];
    },
    async change(operation, user, args = []) {
      for (let attempt = 0; attempt < 5; attempt++) {
        const engine = new Games();
        let id, previous = '';
        if (operation !== 'create') {
          id = operation === 'advance' ? args[0] : operation === 'join' ? String(args[0]).trim().toUpperCase() : await redis.get(key(`member:${user.id}`));
          if (!id) throw new Error('你尚未加入房间');
          previous = await redis.get(key(`room:${id}`));
          if (!previous) { if (operation === 'advance') return null; throw new Error('房间不存在或已关闭'); }
          engine.rooms.set(id, JSON.parse(previous));
        }
        const room = operation === 'create' ? engine.create(user, ...args)
          : operation === 'join' ? engine.join(user, id)
          : operation === 'advance' ? engine.advance(...args)
          : engine[operation](user.id, ...args);
        if (!room) return null;
        if (operation === 'advance') user = { id: room.players[0].id };
        id = room.id; room.revision = (room.revision || 0) + 1;
        const members = [user.id, ...room.players.filter((p) => p.id !== user.id).map((p) => p.id)];
        const keys = [key(`room:${id}`), key('rooms'), ...members.map((member) => key(`member:${member}`))];
        const result = await redis.eval(COMMIT, keys.length, ...keys, previous || '', JSON.stringify(room), id, ROOM_SECONDS, operation, Date.now());
        if (result === 1) return room;
        if (result === -2) throw new Error('请先离开当前房间');
        if (result === -3) throw new Error('房间已满，请稍后再试');
        if (result === -4) throw new Error('你尚未加入房间');
      }
      throw new Error('棋局状态刚刚改变，请重试');
    },
    create(user, options) { return this.change('create', user, [options]); },
    join(user, id) { return this.change('join', user, [id]); },
    move(id, x, y) { return this.change('move', { id }, [x, y]); },
    resign(id) { return this.change('resign', { id }); },
    rematch(id) { return this.change('rematch', { id }); },
    leave(id) { return this.change('leave', { id }); },
    lightsAction(id, command, online) { return this.change('lightsAction', { id }, [command, online]); },
    mazeAction(id, command, online) { return this.change('mazeAction', { id }, [command, online]); },
    gravityAction(id, command, online) { return this.change('gravityAction', { id }, [command, online]); },
    sokobanAction(id, command, online) { return this.change('sokobanAction', { id }, [command, online]); },
    readySnake(id, online) { return this.change('readySnake', { id }, [online]); },
    turnSnake(id, direction) { return this.change('turnSnake', { id }, [direction]); },
    advance(id, now, online) { return this.change('advance', {}, [id, now, online]); },
  };
  return {
    kind: 'redis', store, games, get ready() { return ready(); },
    async presence(touch = [], remove = []) {
      const users = await redis.eval(PRESENCE, 2, key('connections'), key('connectionUsers'), Date.now(), JSON.stringify({ touch, remove }));
      return [...new Set(users)];
    },
    async limit(name, maximum, duration) {
      const count = await redis.eval(`local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('PEXPIRE',KEYS[1],ARGV[1]) end; return n`, 1, key(`limit:${digest(name)}`), duration);
      return count <= maximum;
    },
    listen(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    async publish(event) { await redis.publish(channel, JSON.stringify(event)); },
    async close() { listeners.clear(); redis.disconnect(); subscriber.disconnect(); },
  };
}
