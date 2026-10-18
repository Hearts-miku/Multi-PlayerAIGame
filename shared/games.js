// Public metadata only: never import server rules or credentials into this file.
export const GAME_CATALOG = Object.freeze({
  gomoku: Object.freeze({ name: '五子棋', modes: Object.freeze({ versus: '双人对战' }) }),
  snake: Object.freeze({ name: '贪食蛇', modes: Object.freeze({ versus: '双人对战', coop: '双人合作' }) }),
});
export function gameInfo(id) { return Object.hasOwn(GAME_CATALOG, id) ? GAME_CATALOG[id] : undefined; }
