import test from 'node:test';
import assert from 'node:assert/strict';
import { Games } from '../server/game.js';

const a = { id: 'a', displayName: '甲' }, b = { id: 'b', displayName: '乙' };
function setup(mode = 'versus') {
  const games = new Games(), room = games.create(a, { game: 'snake', mode });
  games.join(b, room.id); games.readySnake(a.id, ['a', 'b']); games.readySnake(b.id, ['a', 'b']);
  return { games, room, step: () => games.advance(room.id, room.snake.nextTick, ['a', 'b']) };
}

test('snake: readiness, no reverse or double turn, membership and game isolation', () => {
  const { games, room, step } = setup();
  assert.equal(room.snake.phase, 'running'); assert.ok(room.snake.nextTick > Date.now());
  assert.throws(() => games.turnSnake('outsider', 'up'), /尚未加入/);
  assert.throws(() => games.turnSnake('a', 'left'), /掉头/);
  assert.throws(() => games.turnSnake('a', '__proto__'), /无效/);
  assert.throws(() => games.move('a', 0, 0), /不是五子棋/);
  games.turnSnake('a', 'up'); assert.throws(() => games.turnSnake('a', 'down'), /本步已转向/);
  const now = room.snake.nextTick; step();
  assert.deepEqual(room.snake.bodies[0][0], [5, 5]);
  assert.equal(games.advance(room.id, now, ['a', 'b']), null);
  assert.equal(room.snake.ticks, 1);
  games.resign('a'); games.rematch('a'); games.rematch('b');
  assert.equal(room.snake.phase, 'ready'); assert.deepEqual(room.snake.scores, [0, 0]);
  assert.throws(() => games.readySnake('a', ['a']), /双方在线/);
  games.leave('a'); const gomoku = games.create(a);
  assert.equal(gomoku.game, 'gomoku'); assert.throws(() => games.turnSnake('a', 'up'), /不是贪食蛇/);
  assert.throws(() => games.create(b, { game: 'snake', mode: 'invalid' }), /无效/);
});

test('snake: both snakes eat, grow and food never spawns inside a snake', () => {
  const { room, step } = setup();
  for (let i = 0; i < 4; i++) step();
  assert.deepEqual(room.snake.scores, [1, 1]);
  assert.deepEqual(room.snake.bodies.map((body) => body.length), [4, 4]);
  for (const food of room.snake.food) assert.ok(!room.snake.bodies.flat().some((cell) => cell.join() === food.join()));
});

test('snake: walls, self collision, opposing body, head-on and head swap', () => {
  const cases = [
    { bodies: [[[0, 2], [1, 2]], [[20, 20], [21, 20]]], directions: ['left', 'left'], winner: 2 },
    { bodies: [[[2, 2], [2, 3], [3, 3], [3, 2], [3, 1]] , [[20, 20], [21, 20]]], directions: ['right', 'left'], winner: 2 },
    { bodies: [[[2, 2], [1, 2]], [[4, 2], [3, 2], [3, 3]]], directions: ['right', 'right'], winner: 2 },
    { bodies: [[[2, 2], [1, 2]], [[4, 2], [5, 2]]], directions: ['right', 'left'], winner: null },
    { bodies: [[[2, 2]], [[3, 2]]], directions: ['right', 'left'], winner: null },
  ];
  for (const item of cases) {
    const { room, step } = setup(); Object.assign(room.snake, { bodies: item.bodies, directions: item.directions, food: [[10, 10]] }); step();
    assert.equal(room.status, 'finished'); assert.equal(room.winner, item.winner);
  }
});

test('snake: vacated tails are safe but growing tails stay occupied', () => {
  const { room, step } = setup();
  Object.assign(room.snake, { bodies: [[[2, 2], [1, 2]], [[4, 2], [3, 2]]], directions: ['right', 'right'], food: [[10, 10]] });
  step(); assert.equal(room.status, 'playing'); assert.deepEqual(room.snake.bodies[0][0], [3, 2]);
  const growing = setup();
  Object.assign(growing.room.snake, { bodies: [[[2, 2], [1, 2]], [[4, 2], [3, 2]]], directions: ['right', 'right'], food: [[5, 2]] });
  growing.step(); assert.equal(growing.room.winner, 2);
});

test('snake cooperation: combined goal wins, any collision or surrender loses', () => {
  const success = setup('coop'); success.room.snake.scores = [9, 9];
  for (let i = 0; i < 4; i++) success.step();
  assert.equal(success.room.reason, 'team-goal'); assert.equal(success.room.status, 'finished');
  const failure = setup('coop'); failure.games.turnSnake('a', 'up');
  for (let i = 0; i < 7; i++) failure.step();
  assert.equal(failure.room.reason, 'team-crash'); assert.equal(failure.room.winner, null);
  const surrender = setup('coop'); surrender.games.resign('a');
  assert.equal(surrender.room.reason, 'team-abandon');
});

test('snake: disconnect and scheduler stalls pause without catch-up or losing position', () => {
  const { games, room } = setup();
  const original = structuredClone(room.snake.bodies);
  games.advance(room.id, Date.now(), ['a']);
  assert.equal(room.snake.phase, 'paused'); assert.deepEqual(room.snake.bodies, original);
  games.readySnake('a', ['a', 'b']); assert.equal(room.snake.phase, 'paused');
  games.readySnake('b', ['a', 'b']); assert.equal(room.snake.phase, 'running');
  games.advance(room.id, room.snake.nextTick + 1600, ['a', 'b']);
  assert.equal(room.snake.phase, 'paused'); assert.equal(room.snake.ticks, 0);
});
