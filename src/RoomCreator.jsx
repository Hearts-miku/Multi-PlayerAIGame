import React, { useEffect, useRef } from 'react';

export default function RoomCreator({ open, disabled, pending, onClose, onCreate, game, mode, onSelectMode, error }) {
  const dialogRef = useRef(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);
  return <dialog ref={dialogRef} className="room-creator create-dialog" aria-labelledby="create-room-title" aria-describedby="create-room-description" onCancel={(event) => { event.preventDefault(); if (!pending) onClose(); }}>
    <div className="create-dialog-heading"><h3 id="create-room-title">{game === 'gomoku' ? '五子棋' : '贪食蛇'} · 创建房间</h3><button type="button" className="text-button" aria-label="关闭创建房间" disabled={pending} onClick={onClose}>×</button></div>
    <p id="create-room-description">选择模式，创建后邀请朋友加入。</p>
    <form onSubmit={(event) => { event.preventDefault(); if (!disabled) onCreate({ game, mode }); }}>
      <fieldset disabled={disabled}><legend>选择模式</legend><div className="room-options">
        <label><input autoFocus type="radio" name="mode" value="versus" checked={mode === 'versus'} onChange={() => onSelectMode('versus')}/><span>双人对战</span></label>
        {game === 'snake' && <label><input type="radio" name="mode" value="coop" checked={mode === 'coop'} onChange={() => onSelectMode('coop')}/><span>双人合作</span></label>}
      </div></fieldset>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="create-dialog-actions"><button type="button" className="secondary" disabled={pending} onClick={onClose}>取消</button><button className="primary" disabled={disabled}>{pending ? '创建中…' : '创建房间'} <span>↗</span></button></div>
    </form>
  </dialog>;
}
