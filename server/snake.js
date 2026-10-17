import { randomInt } from 'node:crypto';

export const SNAKE_SIZE = 24;
export const SNAKE_TICK = 300;
const vectors = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const same = (a, b) => a[0] === b[0] && a[1] === b[1];

export function newSnake() {
  return {
    size: SNAKE_SIZE, tickMs: SNAKE_TICK, goal: 20, phase: 'ready', ready: [], ticks: 0,
    bodies: [[[5, 6], [4, 6], [3, 6]], [[18, 17], [19, 17], [20, 17]]],
    directions: ['right', 'left'], queued: [null, null], scores: [0, 0],
    food: [[9, 6], [14, 17]], nextTick: null,
  };
}

export function snakeReady(room, userId, online, now = Date.now()) {
  if (room.status !== 'playing' || room.snake.phase === 'running') throw new Error('当前不能准备');
  if (!room.players.every((p) => online.includes(p.id))) throw new Error('等待双方在线后再准备');
  const state = room.snake;
  if (!state.ready.includes(userId)) state.ready.push(userId);
  if (state.ready.length === 2) {
    state.phase = 'running'; state.nextTick = now + 3000; state.queued = [null, null];
  }
  room.updatedAt = now;
  return room;
}

export function snakeTurn(room, userId, direction) {
  const state = room.snake, index = room.players.findIndex((p) => p.id === userId);
  if (room.status !== 'playing' || state.phase !== 'running') throw new Error('等待双方准备后再操作');
  if (!Object.hasOwn(vectors, direction)) throw new Error('无效的方向');
  const [dx, dy] = vectors[direction], [cx, cy] = vectors[state.directions[index]];
  if (dx + cx === 0 && dy + cy === 0) throw new Error('不能直接掉头');
  if (state.queued[index] && state.queued[index] !== direction) throw new Error('本步已转向，请等待下一步');
  state.queued[index] = direction;
  return room;
}

// Resolve both heads simultaneously. Vacated tails are safe; growing tails
// remain occupied. Head swaps and head-on collisions eliminate both snakes.
export function advanceSnake(room, now, online) {
  const s = room.snake;
  if (room.status !== 'playing' || s.phase !== 'running') return null;
  if (!room.players.every((p) => online.includes(p.id)) || now > s.nextTick + 1500) {
    s.phase = 'paused'; s.ready = []; s.queued = [null, null]; s.nextTick = null;
    room.updatedAt = now; return room;
  }
  if (now < s.nextTick) return null;
  const directions = s.directions.map((d, i) => s.queued[i] || d);
  const heads = s.bodies.map((body, i) => { const v = vectors[directions[i]]; return [body[0][0] + v[0], body[0][1] + v[1]]; });
  const eating = heads.map((head) => s.food.some((food) => same(head, food)));
  const obstacles = s.bodies.flatMap((body, i) => eating[i] ? body : body.slice(0, -1));
  const headCollision = same(heads[0], heads[1]) || (same(heads[0], s.bodies[1][0]) && same(heads[1], s.bodies[0][0]));
  const dead = heads.map((head) => headCollision || head.some((v) => v < 0 || v >= s.size) || obstacles.some((cell) => same(cell, head)));
  s.directions = directions; s.queued = [null, null]; s.ticks++; s.nextTick = now + s.tickMs;
  room.updatedAt = now;
  if (dead.some(Boolean)) {
    room.status = 'finished'; s.phase = 'finished'; s.dead = dead;
    room.reason = room.mode === 'coop' ? 'team-crash' : dead.every(Boolean) ? 'draw' : 'crash';
    room.winner = room.mode === 'coop' || dead.every(Boolean) ? null : room.players[dead[0] ? 1 : 0].color;
    return room;
  }
  s.bodies = s.bodies.map((body, i) => [heads[i], ...body.slice(0, eating[i] ? undefined : -1)]);
  eating.forEach((ate, i) => { if (ate) s.scores[i]++; });
  s.food = s.food.filter((food) => !heads.some((head) => same(head, food)));
  if (room.mode === 'coop' && s.scores.reduce((a, b) => a + b, 0) >= s.goal) {
    room.status = 'finished'; s.phase = 'finished'; room.reason = 'team-goal'; room.winner = null;
    return room;
  }
  const occupied = new Set([...s.bodies.flat(), ...s.food].map((cell) => cell.join(','))), free = [];
  for (let y = 0; y < s.size; y++) for (let x = 0; x < s.size; x++) if (!occupied.has(`${x},${y}`)) free.push([x, y]);
  while (s.food.length < 2 && free.length) s.food.push(free.splice(randomInt(free.length), 1)[0]);
  if (!free.length && !s.food.length) { room.status = 'finished'; s.phase = 'finished'; room.reason = 'draw'; }
  return room;
}
