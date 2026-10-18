import React, { useState } from 'react';

export default function RoomCreator({ disabled, onCreate }) {
  const [game, setGame] = useState('gomoku');
  const [mode, setMode] = useState('versus');
  function selectGame(next) {
    setGame(next);
    setMode('versus');
  }
  return <section className="room-creator" aria-labelledby="create-room-title">
    <div><h3 id="create-room-title">创建一个房间</h3><p>先选择游戏和模式，创建后邀请朋友加入。</p></div>
    <form onSubmit={(event) => { event.preventDefault(); if (!disabled) onCreate({ game, mode }); }}>
      <fieldset disabled={disabled}><legend>1 · 选择游戏</legend><div className="room-options">
        {[['gomoku', '五子棋'], ['snake', '贪食蛇']].map(([value, label]) => <label key={value}><input type="radio" name="game" value={value} checked={game === value} onChange={() => selectGame(value)}/><span>{label}</span></label>)}
      </div></fieldset>
      <fieldset disabled={disabled}><legend>2 · 选择模式</legend><div className="room-options">
        <label><input type="radio" name="mode" value="versus" checked={mode === 'versus'} onChange={() => setMode('versus')}/><span>双人对战</span></label>
        {game === 'snake' && <label><input type="radio" name="mode" value="coop" checked={mode === 'coop'} onChange={() => setMode('coop')}/><span>双人合作</span></label>}
      </div></fieldset>
      <div className="create-room-submit"><p aria-live="polite">{game === 'gomoku' ? '五子棋' : '贪食蛇'} · {mode === 'coop' ? '双人合作' : '双人对战'}</p><button className="primary" disabled={disabled}>创建房间 <span>↗</span></button></div>
    </form>
  </section>;
}
