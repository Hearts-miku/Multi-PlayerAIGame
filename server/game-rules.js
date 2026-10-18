import { GAME_CATALOG } from '../shared/games.js';
import { newGomoku, moveGomoku, resetGomoku } from './gomoku.js';
import { newSnake, snakeReady, snakeTurn, advanceSnake } from './snake.js';

// Extensions get their own ID; an addition must never replace existing rules.
export function extendRules(base, additions) {
  const result = Object.assign(Object.create(null), base);
  for (const [id, definition] of Object.entries(additions)) {
    if (Object.hasOwn(result, id)) throw new Error(`Duplicate game: ${id}`);
    if (!/^[a-z][a-z0-9-]*$/.test(id) || !Array.isArray(definition.modes) || !definition.modes.length ||
        !['initial', 'reset', 'resign'].every((key) => typeof definition[key] === 'function')) throw new Error(`Invalid game: ${id}`);
    result[id] = Object.freeze({ ...definition, modes: Object.freeze([...definition.modes]) });
  }
  return Object.freeze(result);
}
const resign = (room, userId) => {
  room.winner = 3 - room.players.find((player) => player.id === userId).color;
  room.reason = 'resign';
};
export const GAME_RULES = extendRules({}, {
  gomoku: { modes: Object.keys(GAME_CATALOG.gomoku.modes), initial: newGomoku, reset: resetGomoku, resign, move: moveGomoku },
  snake: {
    modes: Object.keys(GAME_CATALOG.snake.modes), initial: () => ({ snake: newSnake(), turn: 1 }),
    reset: (room) => { room.snake = newSnake(); },
    resign: (room, userId) => {
      resign(room, userId); room.snake.phase = 'finished';
      if (room.mode === 'coop') { room.winner = null; room.reason = 'team-abandon'; }
    },
    ready: snakeReady, turn: snakeTurn, advance: advanceSnake,
  },
});
