import LightsMatch, { LightsCard } from './Lights.jsx';
import MazeMatch, { MazeCard } from './Maze.jsx';
import GravityMatch, { GravityCard } from './Gravity.jsx';
import SokobanMatch, { SokobanCard } from './Sokoban.jsx';
import GomokuMatch, { GomokuCard } from './Gomoku.jsx';
import SnakeMatch, { SnakeCard } from './Snake.jsx';

export const GAME_VIEWS = Object.freeze(Object.assign(Object.create(null), {
  maze: Object.freeze({ Card: MazeCard, Match: MazeMatch, heading: '你探路，我寻宝。', description: '每次出发，都是一张新的冒险地图。' }),
  lights: Object.freeze({ Card: LightsCard, Match: LightsMatch, heading: '让星光，重新连成一片。', description: '两种颜色，同一个点亮计划。' }),
  gravity: Object.freeze({ Card: GravityCard, Match: GravityMatch, heading: '换个方向，改写胜负。', description: '每个人，都有一次颠倒局势的机会。' }),
  gomoku: Object.freeze({ Card: GomokuCard, Match: GomokuMatch, heading: '落子之间，见高下。', description: '不急，想好这一步。' }),
  sokoban: Object.freeze({ Card: SokobanCard, Match: SokobanMatch, heading: '你来开门，我来搬运。', description: '两个人，一起把箱子送回家。' }),
  snake: Object.freeze({ Card: SnakeCard, Match: SnakeMatch, heading: '灵活转弯，默契同行。', description: '两条蛇，一片果园。准备好一起出发。' }),
}));
