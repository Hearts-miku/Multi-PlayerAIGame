import { gameInfo } from '../shared/games.js';
import React, { useEffect, useRef } from 'react';

export default function RoomCreator({ open, disabled, pending, onClose, onCreate, game, mode, onSelectMode, error }) {
  const info = gameInfo(game);
  const dialogRef = useRef(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);
  return <dialog ref={dialogRef} className="room-creator create-dialog" aria-labelledby="create-room-title" aria-describedby="create-room-description" onCancel={(event) => { event.preventDefault(); if (!pending) onClose(); }}>
    <div className="create-dialog-heading"><h3 id="create-room-title">{info?.name || '未知游戏'} · 创建房间</h3><button type="button" className="text-button" aria-label="关闭创建房间" disabled={pending} onClick={onClose}>×</button></div>
    <p id="create-room-description">选择模式，创建后邀请朋友加入。</p>
    <form onSubmit={(event) => { event.preventDefault(); if (!disabled && info && Object.hasOwn(info.modes, mode)) onCreate({ game, mode }); }}>
      <fieldset disabled={disabled}><legend>选择模式</legend><div className="room-options">
        {Object.entries(info?.modes || {}).map(([value, label], index) => <label key={value}><input autoFocus={index === 0} type="radio" name="mode" value={value} checked={mode === value} onChange={() => onSelectMode(value)}/><span>{label}</span></label>)}
      </div></fieldset>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="create-dialog-actions"><button type="button" className="secondary" disabled={pending} onClick={onClose}>取消</button><button className="primary" disabled={disabled}>{pending ? '创建中…' : '创建房间'} <span>↗</span></button></div>
    </form>
  </dialog>;
}
