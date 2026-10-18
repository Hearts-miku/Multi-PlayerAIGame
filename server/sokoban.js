const directions = Object.freeze({ up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] });
const same = (a, b) => a[0] === b[0] && a[1] === b[1];
const has = (cells, cell) => cells.some((p) => same(p, cell));
const border = (width, height) => Array.from({ length: width * height }, (_, i) => [i % width, Math.floor(i / width)]).filter(([x, y]) => x === 0 || y === 0 || x === width - 1 || y === height - 1);
const levels = [
  { name: '各司其职', hint: '每人只能推动自己颜色的箱子。绕到箱子后方，把它送到同色圆点。', width: 9, height: 7,
    walls: [...border(9, 7), [4, 2], [4, 3], [4, 4]], gates: [], plates: [],
    actors: [[2, 4], [6, 4]], boxes: [[2, 3], [6, 3]], goals: [[2, 1], [6, 1]] },
  { name: '为你开门', hint: '蓝色先踩左上机关，橙色运箱过门；橙色回来接班，让蓝色把箱子送回左侧。', width: 9, height: 7,
    walls: [...border(9, 7), [4, 1], [4, 2], [4, 4], [4, 5]], gates: [[4, 3]], plates: [[2, 1]],
    actors: [[1, 3], [1, 1]], boxes: [[2, 3], [6, 4]], goals: [[5, 2], [2, 3]] },
  { name: '默契接力', hint: '任一机关都能开门。先把橙箱送到右上，再接力把蓝箱送到左下。', width: 11, height: 9,
    walls: [...border(11, 9), [5, 1], [5, 2], [5, 3], [5, 5], [5, 6], [5, 7], [2, 6], [3, 6], [7, 2], [8, 2], [3, 2]],
    gates: [[5, 4]], plates: [[2, 2], [8, 6]], actors: [[2, 4], [1, 2]], boxes: [[3, 4], [8, 4]], goals: [[8, 3], [2, 5]] },
];

export function newSokoban(level = 0, round = 0, revision = 0) {
  return { ...structuredClone(levels[level]), level, totalLevels: levels.length, round, revision,
    phase: 'active', moves: 0, pushes: [0, 0], history: [], votes: { restart: [], next: [] } };
}
export function gateOpen(s) { return s.plates.some((p) => has(s.actors, p)); }
export function sokobanAction(room, userId, command, online) {
  if (room.status !== 'playing' || room.players.length !== 2) throw new Error('等待双方加入后再操作');
  if (!room.players.every((p) => online.includes(p.id))) throw new Error('等待队友重新上线后继续');
  const s = room.sokoban, player = room.players.findIndex((p) => p.id === userId);
  if (player < 0) throw new Error('你不在这个房间中');
  if (!command || command.round !== s.round) throw new Error('关卡已更新，请等待同步后重试');
  const { kind } = command;
  if (kind === 'restart' || kind === 'next') {
    if (kind === 'next' && s.phase !== 'cleared') throw new Error('先完成当前关卡');
    if (kind === 'next' && s.level + 1 >= levels.length) throw new Error('已经完成全部关卡');
    if (s.votes[kind].includes(userId)) return room;
    s.votes[kind].push(userId);
    if (s.votes[kind].length === 2) room.sokoban = newSokoban(s.level + (kind === 'next' ? 1 : 0), s.round + 1, s.revision + 1);
    else s.revision++;
  } else {
    if (command.revision !== s.revision) throw new Error('队友刚刚移动，请同步后再走一步');
    if (kind === 'undo') {
      const last = s.history.at(-1);
      if (!last || last.userId !== userId) throw new Error('只能撤销自己刚走的最后一步');
      Object.assign(s, { actors: last.actors, boxes: last.boxes, pushes: last.pushes, moves: last.moves, phase: 'active', votes: { restart: [], next: [] } });
      s.history.pop(); s.revision++;
    } else if (kind === 'move') {
      if (s.phase !== 'active') throw new Error('本关已完成，等待双方进入下一关');
      if (!Object.hasOwn(directions, command.direction)) throw new Error('无效的方向');
      const [dx, dy] = directions[command.direction], from = s.actors[player], next = [from[0] + dx, from[1] + dy];
      const blocked = ([x, y]) => x < 0 || y < 0 || x >= s.width || y >= s.height || has(s.walls, [x, y]) || (has(s.gates, [x, y]) && !gateOpen(s));
      if (blocked(next)) throw new Error('这里是墙壁或关闭的门');
      if (same(next, s.actors[1 - player])) throw new Error('队友在这里，请商量让路');
      const box = s.boxes.findIndex((p) => same(p, next));
      const destination = [next[0] + dx, next[1] + dy];
      if (box >= 0 && box !== player) throw new Error('只能推动自己颜色的箱子');
      if (box >= 0 && (blocked(destination) || has(s.boxes, destination) || has(s.actors, destination))) throw new Error('箱子前面没有空间');
      const actors = s.actors.map((p, i) => i === player ? next : [...p]);
      const boxes = s.boxes.map((p, i) => i === box ? destination : [...p]);
      if (gateOpen(s) && !gateOpen({ ...s, actors }) && s.gates.some((p) => has(actors, p) || has(boxes, p))) throw new Error('门内还有人或箱子，请继续踩住机关');
      s.history.push({ userId, actors: structuredClone(s.actors), boxes: structuredClone(s.boxes), pushes: [...s.pushes], moves: s.moves });
      if (s.history.length > 100) s.history.shift();
      s.actors = actors; s.boxes = boxes; s.moves++; if (box >= 0) s.pushes[box]++;
      s.votes = { restart: [], next: [] }; s.revision++;
      if (s.boxes.every((p, i) => same(p, s.goals[i]))) {
        s.phase = 'cleared';
        if (s.level === levels.length - 1) { room.status = 'finished'; room.winner = null; room.reason = 'sokoban-complete'; }
      }
    } else throw new Error('无效的操作');
  }
  room.updatedAt = Date.now();
  return room;
}
