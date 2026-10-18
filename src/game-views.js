import GomokuMatch, { GomokuCard } from './Gomoku.jsx';
import SnakeMatch, { SnakeCard } from './Snake.jsx';

export const GAME_VIEWS = Object.freeze(Object.assign(Object.create(null), {
  gomoku: Object.freeze({ Card: GomokuCard, Match: GomokuMatch, heading: '落子之间，见高下。', description: '不急，想好这一步。' }),
  snake: Object.freeze({ Card: SnakeCard, Match: SnakeMatch, heading: '灵活转弯，默契同行。', description: '两条蛇，一片果园。准备好一起出发。' }),
}));
