import { randomBytes } from 'node:crypto';
import { GAME_RULES } from './game-rules.js';
export { SIZE, winningLine } from './gomoku.js';

export class Games {
  rooms = new Map();
  constructor(rules = GAME_RULES) { this.rules = rules; }
  rulesFor(room) {
    // Only missing metadata is a legacy Gomoku room; unknown IDs never fall back.
    const definition = this.rules[room.game ?? 'gomoku'];
    if (!definition) throw new Error('不支持的游戏');
    return definition;
  }
  list() { return [...this.rooms.values()]; }
  get(id) { return this.rooms.get(id); }
  roomFor(userId) { return [...this.rooms.values()].find((room) => room.players.some((p) => p.id === userId)); }
  create(user, { game = 'gomoku', mode = 'versus' } = {}) {
    const definition = this.rules[game];
    if (!definition?.modes.includes(mode)) throw new Error('无效的游戏或模式');
    if (this.roomFor(user.id)) throw new Error('请先离开当前房间');
    if (this.rooms.size >= 500) throw new Error('房间已满，请稍后再试');
    let id;
    do { id = randomBytes(4).toString('hex').toUpperCase(); } while (this.rooms.has(id));
    const room = { id, players: [{ ...user, color: 1 }], status: 'waiting', winner: null, rematch: [], updatedAt: Date.now() };
    Object.assign(room, definition.initial(), { game, mode });
    this.rooms.set(id, room);
    return room;
  }
  join(user, id) {
    const room = this.rooms.get(String(id).trim().toUpperCase());
    if (!room) throw new Error('房间不存在或已关闭');
    this.rulesFor(room);
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
    if ((room.game ?? 'gomoku') !== 'gomoku') throw new Error('该房间不是五子棋');
    return this.rulesFor(room).move(room, userId, x, y);
  }
  resign(userId) {
    const room = this.member(userId);
    if (room.status !== 'playing') throw new Error('当前没有进行中的对局');
    this.rulesFor(room).resign(room, userId);
    room.status = 'finished'; room.updatedAt = Date.now();
    return room;
  }
  rematch(userId) {
    const room = this.member(userId);
    if (room.status !== 'finished' || room.players.length !== 2) throw new Error('等待双方到齐并完成本局');
    const definition = this.rulesFor(room);
    if (!room.rematch.includes(userId)) room.rematch.push(userId);
    if (room.rematch.length === 2) {
      definition.reset(room);
      Object.assign(room, { status: 'playing', winner: null, reason: undefined, rematch: [] });
    }
    room.updatedAt = Date.now(); return room;
  }
  leave(userId) {
    const room = this.member(userId);
    // Leaving closes the table for both players; reconnecting does not count as leaving.
    this.rooms.delete(room.id); return room;
  }
  sokobanAction(userId, command, online) {
    const room = this.member(userId);
    if (room.game !== 'sokoban') throw new Error('该房间不是默契搬运队');
    return this.rulesFor(room).action(room, userId, command, online);
  }
  snakeRoom(userId) {
    const room = this.member(userId);
    if (room.game !== 'snake') throw new Error('该房间不是贪食蛇');
    return room;
  }
  readySnake(userId, online) { const room = this.snakeRoom(userId); return this.rulesFor(room).ready(room, userId, online); }
  turnSnake(userId, direction) { const room = this.snakeRoom(userId); return this.rulesFor(room).turn(room, userId, direction); }
  advance(id, now, online) {
    const room = this.get(id);
    return room ? this.rulesFor(room).advance?.(room, now, online) ?? null : null;
  }
}
