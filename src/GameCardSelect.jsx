import React from 'react';

export default function GameCardSelect({ name, selected, disabled, onSelect }) {
  return <button type="button" className="game-card-select" aria-label={`选择${name}`} aria-pressed={selected} disabled={disabled} onClick={onSelect}>
    <span>{selected ? '✓ 已选中' : '选择游戏 ↗'}</span>
  </button>;
}
