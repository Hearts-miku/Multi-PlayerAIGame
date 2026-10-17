import { randomBytes } from 'node:crypto';
import { newSnake, snakeReady, snakeTurn, advanceSnake } from './snake.js';

export const SIZE = 15;
export function winningLine(board, x, y, color) {
  for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
    const line = [[x, y]];
    for (const sign of [-1, 1]) {
      let nx = x + dx * sign, ny = y + dy * sign;
      while (nx >= 0 && nx < SIZE && ny >= 0 && ny < SIZE && board[ny * SIZE + nx] === color) {
        line.push([nx, ny]); nx += dx * sign; ny += dy * sign;
      }
    }
    if (line.length >= 5) return line;
  }
  return null;
}

export class Games {
  rooms = new Map();
  list() { return [...this.rooms.values()]; }
  get(id) { return this.rooms.get(id); }
  roomFor(userId) { return [...this.rooms.values()].find((room) => room.players.some((p) => p.id === userId)); }
  create(user, { game = 'gomoku', mode = 'versus' } = {}) {
    if (!['gomoku', 'snake'].includes(game) || !['versus', 'coop'].includes(mode) || (game === 'gomoku' && mode !== 'versus')) throw new Error('无效的游戏或模式');
    if (this.roomFor(user.id)) throw new Error('请先离开当前房间');
    if (this.rooms.size >= 500) throw new Error('房间已满，请稍后再试');
    let id;
    do { id = randomBytes(4).toString('hex').toUpperCase(); } while (this.rooms.has(id));
    const room = { id, players: [{ ...user, color: 1 }], board: Array(SIZE * SIZE).fill(0), moves: [], status: 'waiting', turn: 1, winner: null, winLine: [], rematch: [], updatedAt: Date.now() };
    this.rooms.set(id, room);
    room.game = game; room.mode = mode;
    if (game === 'snake') { room.snake = newSnake(); delete room.board; delete room.moves; delete room.winLine; }
    return room;
  }
  join(user, id) {
    const room = this.rooms.get(String(id).trim().toUpperCase());
    if (!room) throw new Error('房间不存在或已关闭');
    if (room.players.some((p) => p.id === user.id)) return room;
    if (this.roomFor(user.id)) throw new Error('请先离开当前房间');
    if (room.players.length >= 2 || room.status !== 'waiting') throw new Error('房间已满或对局已开始');
    room.players.push({ ...user, color: 2 }); room.status = 'playing'; room.updatedAt = Date.now();
    return room;
  }
  member(userId) {
    const room = this.roomFor(userId);
    if (!room) throw new Error('你尚未加入房间');
    return room;
  }
  move(userId, x, y) {
    const room = this.member(userId);
    if (room.game === 'snake') throw new Error('该房间不是五子棋');
    if (room.status !== 'playing') throw new Error('当前不能落子');
    const player = room.players.find((p) => p.id === userId);
    if (player.color !== room.turn) throw new Error('请等待对手落子');
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || x >= SIZE || y < 0 || y >= SIZE) throw new Error('无效的落子位置');
    if (room.board[y * SIZE + x]) throw new Error('这里已经有棋子了');
    room.board[y * SIZE + x] = player.color;
    room.moves.push({ x, y, color: player.color }); room.updatedAt = Date.now();
    const line = winningLine(room.board, x, y, player.color);
    if (line) { room.status = 'finished'; room.winner = player.color; room.winLine = line; room.reason = 'five'; }
    else if (room.moves.length === SIZE * SIZE) { room.status = 'finished'; room.reason = 'draw'; }
    else room.turn = 3 - room.turn;
    return room;
  }
  resign(userId) {
    const room = this.member(userId);
    if (room.status !== 'playing') throw new Error('当前没有进行中的对局');
    room.status = 'finished'; room.winner = 3 - room.players.find((p) => p.id === userId).color; room.reason = 'resign'; room.updatedAt = Date.now();
    if (room.game === 'snake') { room.snake.phase = 'finished'; if (room.mode === 'coop') { room.winner = null; room.reason = 'team-abandon'; } }
    return room;
  }
  rematch(userId) {
    const room = this.member(userId);
    if (room.status !== 'finished' || room.players.length !== 2) throw new Error('等待双方到齐并完成本局');
    if (!room.rematch.includes(userId)) room.rematch.push(userId);
    if (room.rematch.length === 2) {
      if (room.game === 'snake') {
        Object.assign(room, { snake: newSnake(), status: 'playing', winner: null, reason: undefined, rematch: [], updatedAt: Date.now() });
        return room;
      }
      room.players.forEach((p) => { p.color = 3 - p.color; });
      Object.assign(room, { board: Array(SIZE * SIZE).fill(0), moves: [], status: 'playing', turn: 1, winner: null, winLine: [], rematch: [], reason: undefined });
    }
    room.updatedAt = Date.now(); return room;
  }
  leave(userId) {
    const room = this.member(userId);
    // Leaving closes the table for both players; reconnecting does not count as leaving.
    this.rooms.delete(room.id); return room;
  }
  snakeRoom(userId) {
    const room = this.member(userId);
    if (room.game !== 'snake') throw new Error('该房间不是贪食蛇');
    return room;
  }
  readySnake(userId, online) { return snakeReady(this.snakeRoom(userId), userId, online); }
  turnSnake(userId, direction) { return snakeTurn(this.snakeRoom(userId), userId, direction); }
  advance(id, now, online) {
    const room = this.get(id);
    return room?.game === 'snake' ? advanceSnake(room, now, online) : null;
  }
}
