import test from 'node:test';
import assert from 'node:assert/strict';
import { Games, winningLine } from '../server/game.js';

const a = { id: 1, displayName: '甲' }, b = { id: 2, displayName: '乙' }, c = { id: 3, displayName: '丙' };
test('four directions, long lines, boundaries, and broken lines', () => {
  for (const [dx, dy, x, y] of [[1, 0, 0, 0], [0, 1, 14, 0], [1, 1, 0, 0], [1, -1, 0, 14]]) {
    const board = Array(225).fill(0);
    for (let i = 0; i < 6; i++) board[(y + dy * i) * 15 + x + dx * i] = 1;
    assert.equal(winningLine(board, x, y, 1).length, 6);
    board[(y + dy * 2) * 15 + x + dx * 2] = 2;
    assert.equal(winningLine(board, x, y, 1), null);
  }
  const board = Array(225).fill(0); [13, 14, 15, 16, 17].forEach((i) => board[i] = 1);
  assert.equal(winningLine(board, 14, 0, 1), null);
});
test('membership, turns, full room, coordinates, winner, consent and rematch colors', () => {
  const games = new Games(), room = games.create(a);
  assert.throws(() => games.move(a.id, 0, 0), /当前/);
  games.join(b, room.id);
  assert.throws(() => games.join(c, room.id), /房间已满/);
  assert.throws(() => games.create(a), /离开/);
  assert.throws(() => games.move(c.id, 0, 0), /尚未/);
  assert.throws(() => games.move(b.id, 0, 0), /等待/);
  for (const [x, y] of [[-1, 0], [15, 0], [0.5, 0], ['0', 0], [0, NaN]]) assert.throws(() => games.move(a.id, x, y), /无效/);
  for (let x = 0; x < 5; x++) {
    games.move(a.id, x, 0);
    if (x < 4) { assert.throws(() => games.move(b.id, x, 0), /已经/); games.move(b.id, x, 1); }
  }
  assert.equal(room.winner, 1); assert.equal(room.status, 'finished'); assert.equal(room.moves.length, 9);
  assert.throws(() => games.move(b.id, 6, 1), /当前/);
  games.rematch(a.id); games.rematch(a.id); assert.equal(room.status, 'finished');
  games.rematch(b.id); assert.equal(room.status, 'playing'); assert.equal(room.moves.length, 0); assert.equal(room.players[0].color, 2);
  games.resign(a.id); assert.equal(room.winner, 1); assert.equal(room.reason, 'resign');
  games.leave(a.id); assert.equal(games.rooms.size, 0); assert.equal(games.roomFor(b.id), undefined);
});
test('last empty cell without five produces draw', () => {
  const games = new Games(), room = games.create(a); games.join(b, room.id);
  room.board = Array.from({ length: 225 }, (_, i) => (Math.floor(i / 15) + Math.floor((i % 15) / 2)) % 2 + 1);
  room.board[0] = 0; room.moves = Array(224).fill({ x: 1, y: 1, color: 1 });
  games.move(a.id, 0, 0); assert.equal(room.status, 'finished'); assert.equal(room.reason, 'draw'); assert.equal(room.winner, null);
});
