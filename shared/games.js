// Public metadata only: never import server rules or credentials into this file.
export const GAME_CATALOG = Object.freeze({
  maze: Object.freeze({ name: '迷雾寻宝', modes: Object.freeze({ coop: '双人合作' }) }),
  lights: Object.freeze({ name: '星灯维修站', modes: Object.freeze({ coop: '双人合作' }) }),
  gravity: Object.freeze({ name: '引力四连', modes: Object.freeze({ versus: '双人对战' }) }),
  gomoku: Object.freeze({ name: '五子棋', modes: Object.freeze({ versus: '双人对战' }) }),
  sokoban: Object.freeze({ name: '默契搬运队', modes: Object.freeze({ coop: '双人合作' }) }),
  snake: Object.freeze({ name: '贪食蛇', modes: Object.freeze({ versus: '双人对战', coop: '双人合作' }) }),
});
export function gameInfo(id) { return Object.hasOwn(GAME_CATALOG, id) ? GAME_CATALOG[id] : undefined; }
