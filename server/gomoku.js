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

export function newGomoku() { return { board: Array(SIZE * SIZE).fill(0), moves: [], turn: 1, winLine: [] }; }
export function moveGomoku(room, userId, x, y) {
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
export function resetGomoku(room) {
  room.players.forEach((player) => { player.color = 3 - player.color; });
  Object.assign(room, newGomoku());
}
