import { gameInfo } from '../shared/games.js';
import React, { useEffect, useRef, useState } from 'react';
import { SOKOBAN_LEVELS } from '../shared/sokoban-levels.js';

export default function RoomCreator({ open, disabled, pending, onClose, onCreate, game, mode, onSelectMode, error }) {
  const info = gameInfo(game);
  const dialogRef = useRef(null);
  const [startLevel, setStartLevel] = useState(0);
  useEffect(() => { if (open) setStartLevel(0); }, [open, game]);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);
  return <dialog ref={dialogRef} className="room-creator create-dialog" aria-labelledby="create-room-title" aria-describedby="create-room-description" onCancel={(event) => { event.preventDefault(); if (!pending) onClose(); }}>
    <div className="create-dialog-heading"><h3 id="create-room-title">{info?.name || '未知游戏'} · 创建房间</h3><button type="button" className="text-button" aria-label="关闭创建房间" disabled={pending} onClick={onClose}>×</button></div>
    <p id="create-room-description">选择模式，创建后邀请朋友加入。</p>
    <form onSubmit={(event) => { event.preventDefault(); if (!disabled && info && Object.hasOwn(info.modes, mode)) onCreate({ game, mode, ...(game === 'sokoban' ? { startLevel } : {}) }); }}>
      <fieldset disabled={disabled}><legend>选择模式</legend><div className="room-options">
        {Object.entries(info?.modes || {}).map(([value, label], index) => <label key={value}><input autoFocus={index === 0} type="radio" name="mode" value={value} checked={mode === value} onChange={() => onSelectMode(value)}/><span>{label}</span></label>)}
      </div></fieldset>
      {game === 'sokoban' && <div className="sokoban-level-picker"><label htmlFor="sokoban-start-level">起始关卡</label><select id="sokoban-start-level" disabled={disabled} value={startLevel} onChange={(event) => setStartLevel(Number(event.target.value))}>{SOKOBAN_LEVELS.map((level, index) => <option key={level.name} value={index}>第 {index + 1} 关 · {level.name}</option>)}</select><p>{SOKOBAN_LEVELS[startLevel].hint}</p><small>双方从所选关卡开始，完成后继续挑战后续关卡。</small></div>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="create-dialog-actions"><button type="button" className="secondary" disabled={pending} onClick={onClose}>取消</button><button className="primary" disabled={disabled}>{pending ? '创建中…' : '创建房间'} <span>↗</span></button></div>
    </form>
  </dialog>;
}
