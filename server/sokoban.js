const directions = Object.freeze({ up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] });
const same = (a, b) => a[0] === b[0] && a[1] === b[1];
const has = (cells, cell) => cells.some((p) => same(p, cell));
import { SOKOBAN_LEVELS as levels } from '../shared/sokoban-levels.js';
import { gateOpen, nextLatches } from '../shared/sokoban-mechanics.js';
export { gateOpen } from '../shared/sokoban-mechanics.js';

export function newSokoban(level = 0, round = 0, revision = 0) {
  return { ...structuredClone(levels[level]), level, totalLevels: levels.length, round, revision,
    latches: [], phase: 'active', moves: 0, pushes: [0, 0], history: [], votes: { restart: [], next: [] } };
}
export function sokobanAction(room, userId, command, online) {
  if (room.status !== 'playing' || room.players.length !== 2) throw new Error('等待双方加入后再操作');
  if (!room.players.every((p) => online.includes(p.id))) throw new Error('等待队友重新上线后继续');
  const s = room.sokoban, player = room.players.findIndex((p) => p.id === userId);
  if (player < 0) throw new Error('你不在这个房间中');
  if (!command || command.round !== s.round) throw new Error('关卡已更新，请等待同步后重试');
  const { kind } = command;
  if (kind === 'restart' || kind === 'next') {
    if (kind === 'next' && s.phase !== 'cleared') throw new Error('先完成当前关卡');
    if (kind === 'next' && s.level + 1 >= s.totalLevels) throw new Error('已经完成全部关卡');
    if (s.votes[kind].includes(userId)) return room;
    s.votes[kind].push(userId);
    if (s.votes[kind].length === 2) room.sokoban = { ...newSokoban(s.level + (kind === 'next' ? 1 : 0), s.round + 1, s.revision + 1), totalLevels: s.totalLevels };
    else s.revision++;
  } else {
    if (command.revision !== s.revision) throw new Error('队友刚刚移动，请同步后再走一步');
    if (kind === 'undo') {
      const last = s.history.at(-1);
      if (!last || last.userId !== userId) throw new Error('只能撤销自己刚走的最后一步');
      Object.assign(s, { actors: last.actors, boxes: last.boxes, pushes: last.pushes, moves: last.moves, latches: last.latches || [], phase: 'active', votes: { restart: [], next: [] } });
      s.history.pop(); s.revision++;
    } else if (kind === 'move') {
      if (s.phase !== 'active') throw new Error('本关已完成，等待双方进入下一关');
      if (!Object.hasOwn(directions, command.direction)) throw new Error('无效的方向');
      const [dx, dy] = directions[command.direction], from = s.actors[player], next = [from[0] + dx, from[1] + dy];
      const blocked = ([x, y]) => x < 0 || y < 0 || x >= s.width || y >= s.height || has(s.walls, [x, y]) || (has(s.gates, [x, y]) && !gateOpen(s, [x, y]));
      if (blocked(next)) throw new Error('这里是墙壁或关闭的门');
      if (same(next, s.actors[1 - player])) throw new Error('队友在这里，请商量让路');
      const box = s.boxes.findIndex((p) => same(p, next));
      const destination = [next[0] + dx, next[1] + dy];
      if (box >= 0 && box !== player) throw new Error('只能推动自己颜色的箱子');
      if (box >= 0 && (blocked(destination) || has(s.boxes, destination) || has(s.actors, destination))) throw new Error('箱子前面没有空间');
      const actors = s.actors.map((p, i) => i === player ? next : [...p]);
      const boxes = s.boxes.map((p, i) => i === box ? destination : [...p]);
      const latches = nextLatches({ ...s, actors, boxes });
      if (s.gates.some((p) => gateOpen(s, p) && !gateOpen({ ...s, actors, boxes, latches }, p) && (has(actors, p) || has(boxes, p)))) throw new Error('门内还有人或箱子，请继续踩住机关');
      s.history.push({ userId, latches: [...(s.latches || [])], actors: structuredClone(s.actors), boxes: structuredClone(s.boxes), pushes: [...s.pushes], moves: s.moves });
      if (s.history.length > 100) s.history.shift();
      s.actors = actors; s.boxes = boxes; s.latches = latches; s.moves++; if (box >= 0) s.pushes[box]++;
      s.votes = { restart: [], next: [] }; s.revision++;
      if (s.boxes.every((p, i) => same(p, s.goals[i]))) {
        s.phase = 'cleared';
        if (s.level === s.totalLevels - 1) { room.status = 'finished'; room.winner = null; room.reason = 'sokoban-complete'; }
      }
    } else throw new Error('无效的操作');
  }
  room.updatedAt = Date.now();
  return room;
}
