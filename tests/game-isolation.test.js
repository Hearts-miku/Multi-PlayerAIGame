import test from 'node:test';
import assert from 'node:assert/strict';
import { Games } from '../server/game.js';
import { GAME_RULES, extendRules } from '../server/game-rules.js';
import { GAME_CATALOG } from '../shared/games.js';

const user = (id) => ({ id, displayName: `player${id}` });
const snapshot = (value) => structuredClone(value);

test('catalog and rule modes agree; built-in IDs cannot be replaced', () => {
  assert.deepEqual(Object.keys(GAME_RULES).sort(), Object.keys(GAME_CATALOG).sort());
  for (const [id, definition] of Object.entries(GAME_RULES)) {
    assert.deepEqual(definition.modes, Object.keys(GAME_CATALOG[id].modes));
    assert.throws(() => extendRules(GAME_RULES, { [id]: definition }), /Duplicate/);
  }
});

test('adding a third rules module preserves existing rooms, modes, rules and rematches', () => {
  const rules = extendRules(GAME_RULES, {
    fixture: { modes: ['versus'], initial: () => ({ fixture: { turns: [] } }),
      reset: (room) => { room.fixture = { turns: [] }; },
      resign: (room) => { room.winner = null; room.reason = 'fixture-end'; },
    },
  });
  const games = new Games(rules);
  const gomoku = games.create(user(1)); games.join(user(2), gomoku.id);
  const versus = games.create(user(3), { game: 'snake', mode: 'versus' }); games.join(user(4), versus.id);
  const coop = games.create(user(5), { game: 'snake', mode: 'coop' }); games.join(user(6), coop.id);
  const original = snapshot(games.list());
  const added = games.create(user(7), { game: 'fixture' }); games.join(user(8), added.id);
  assert.equal(added.board, undefined); assert.equal(added.snake, undefined);
  assert.throws(() => games.move(7, 0, 0), /不是五子棋/);
  assert.throws(() => games.readySnake(7, [7, 8]), /不是贪食蛇/);
  games.resign(7); games.rematch(7); games.rematch(8); games.leave(7);
  assert.deepEqual(games.list(), original);
  assert.throws(() => games.create(user(9), { game: 'unknown' }), /无效/);
  assert.throws(() => games.create(user(9), { game: '__proto__' }), /无效/);
  assert.throws(() => games.create(user(9), { game: 'gomoku', mode: 'coop' }), /无效/);
  assert.throws(() => games.turnSnake(1, 'up'), /不是贪食蛇/);
  assert.throws(() => games.move(3, 0, 0), /不是五子棋/);
  assert.deepEqual(games.list(), original);
  const snakes = snapshot([versus, coop]);
  for (let x = 0; x < 5; x++) { games.move(1, x, 0); if (x < 4) games.move(2, x, 1); }
  assert.equal(gomoku.winner, 1); assert.deepEqual([versus, coop], snakes);
  games.rematch(1); games.rematch(2); assert.equal(gomoku.players[0].color, 2);
  const board = snapshot(gomoku);
  games.readySnake(3, [3, 4]); games.readySnake(4, [3, 4]);
  games.advance(versus.id, versus.snake.nextTick, [3, 4]);
  assert.equal(versus.snake.ticks, 1); assert.deepEqual(coop, snakes[1]); assert.deepEqual(gomoku, board);
  games.resign(3); assert.equal(versus.winner, 2);
  games.rematch(3); games.rematch(4); assert.equal(versus.snake.phase, 'ready');
  const resetVersus = snapshot(versus);
  games.resign(5); assert.equal(coop.reason, 'team-abandon'); assert.equal(coop.winner, null);
  games.rematch(5); games.rematch(6); games.leave(5);
  assert.deepEqual(versus, resetVersus); assert.deepEqual(gomoku, board);
});

test('legacy Gomoku snapshots work; unknown game snapshots are never treated as Gomoku', () => {
  const games = new Games(); const room = games.create(user(1)); games.join(user(2), room.id);
  delete room.game; games.move(1, 0, 0); assert.equal(room.board[0], 1);
  room.game = 'future'; const before = snapshot(room);
  assert.throws(() => games.move(2, 1, 0), /不是五子棋/);
  assert.throws(() => games.resign(1), /不支持/);
  assert.throws(() => games.advance(room.id, Date.now(), [1, 2]), /不支持/);
  assert.deepEqual(room, before);
});
