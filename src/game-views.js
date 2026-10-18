import SokobanMatch, { SokobanCard } from './Sokoban.jsx';
import GomokuMatch, { GomokuCard } from './Gomoku.jsx';
import SnakeMatch, { SnakeCard } from './Snake.jsx';

export const GAME_VIEWS = Object.freeze(Object.assign(Object.create(null), {
  gomoku: Object.freeze({ Card: GomokuCard, Match: GomokuMatch, heading: '落子之间，见高下。', description: '不急，想好这一步。' }),
  sokoban: Object.freeze({ Card: SokobanCard, Match: SokobanMatch, heading: '你来开门，我来搬运。', description: '两个人，一起把箱子送回家。' }),
  snake: Object.freeze({ Card: SnakeCard, Match: SnakeMatch, heading: '灵活转弯，默契同行。', description: '两条蛇，一片果园。准备好一起出发。' }),
}));
