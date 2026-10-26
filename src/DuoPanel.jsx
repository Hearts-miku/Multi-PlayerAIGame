import React from 'react';
export default function DuoPanel({room,user,connected,pending,action,invite,title,children,cooperative=false}) {
  return <aside className="match-panel"><span className="eyebrow">BETTER WITH TWO</span><h2 aria-live="polite">{title}</h2>
    <div className="players">{room.players.map((p,i)=><div className="player" key={p.id}><span>{i===0?'🟠':'🔵'}</span><div><strong>{p.displayName}{p.id===user.id?' · 你':''}</strong><small>{p.online?'在线':'离线'}</small></div></div>)}</div>
    <div className="room-code-box"><small>房间码</small><strong>{room.id}</strong><button className="text-button" onClick={invite}>邀请朋友 ↗</button></div>
    {children}
    {room.status==='finished'&&<button className="primary full" disabled={!connected||pending||room.rematch.includes(user.id)} onClick={()=>action('game:rematch')}>{room.rematch.includes(user.id)?'已准备，等队友…':room.rematch.length?'接受再来一局':'再来一局'}</button>}
    {!cooperative&&room.status==='playing'&&<button className="secondary full" disabled={!connected||pending} onClick={()=>{if(confirm('确定认输吗？'))action('game:resign');}}>认输</button>}
    <button className="text-button leave-button" disabled={!connected||pending} onClick={()=>{if(confirm('离开会关闭双方房间，确定吗？'))action('room:leave');}}>离开房间</button>
  </aside>;
}
