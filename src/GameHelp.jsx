import React, { useId, useState } from 'react';
import { gameInfo } from '../shared/games.js';
import './game-help.css';

const instructions = {
  gomoku: ['双方轮流点击空位落子，黑棋先手。', '横、竖或斜线连成五子即可获胜；无禁手，长连也算赢。'],
  snake: ['双方点击准备后开始。用方向键、WASD 或屏幕方向按钮转向，不能直接掉头。', '吃食物会变长；撞墙、自己或另一条蛇都会失败。'],
  sokoban: ['用方向键、WASD 或屏幕方向按钮移动，只能推动自己颜色的箱子，不能拉箱子。', '两人配合踩机关开门，把两个箱子送到对应目标点即可过关。', '卡住时可撤销自己的最后一步，或双方确认重开；过关后双方准备进入下一关。'],
  lights: ['各自点击自己颜色的开关，它和上下左右的灯都会翻转亮暗。', '让所有灯同时亮起即可过关；再次按同一开关可还原影响。', '商量好操作顺序，双方确认后进入下一关或重开本关。'],
  gravity: ['轮到你时点击一列投放棋子，棋子会沿重力方向落到底。横、竖或斜线四连获胜。', '每人可翻转重力一次，占用一个回合；也可能让对手获胜！', '双方同时四连或棋盘填满则平局。'],
  maze: ['用方向键、WASD 或屏幕方向按钮探索，共享已发现的地图；各自收集自己的两颗宝石，再一起到出口。', '站上传送门可点击传送；两人分别站上两座灯塔能照亮全图，收齐幸运星可争取三星。', '遇到问号会触发随机奇遇；野餐需要两人在同一地点会合。重走或换图需要双方确认。'],
};

export default function GameHelp({ game, mode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const info = gameInfo(game);
  if (!info || !Object.hasOwn(instructions, game)) return null;
  return <section className="game-help" aria-label="游戏玩法">
    <button type="button" className="secondary" aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}>玩法说明 <span aria-hidden="true">{open ? '−' : '?'}</span></button>
    <div id={id} hidden={!open} className="game-help-content">
      <h3>{info.name} · {info.modes[mode]}玩法</h3>
      <ul>{instructions[game].map(line => <li key={line}>{line}</li>)}{game === 'snake' && <li>{mode === 'coop' ? '合作模式：双方合计吃到 20 个食物即成功；任意一条蛇碰撞则挑战结束。' : '对战模式：活到最后获胜；双方同一步碰撞则平局。'}</li>}</ul>
      <p>再次点击“玩法说明”收起。查看说明不会暂停正在进行的游戏。</p>
    </div>
  </section>;
}
