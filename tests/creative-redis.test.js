import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import Redis from 'ioredis';
import { io } from 'socket.io-client';
import { createApp, SOCKET_PATH } from '../server/app.js';
import { redisBackend } from '../server/redis-backend.js';
import { COOKIE } from '../server/store.js';
const origin='http://localhost:5173';
function state(socket,predicate,event='room:update'){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{socket.off(event,listener);reject(new Error('State sync timeout'));},15000);function listener(room){if(predicate(room)){clearTimeout(timer);socket.off(event,listener);resolve(room);}}socket.on(event,listener);});}
for(const game of ['lights','gravity'])for(const storage of ['memory','redis'])test(`${game} ${storage}: authenticated sockets, isolation, atomic moves and recovery`,{skip:storage==='redis'&&!process.env.REDIS_URL,timeout:90000},async()=>{
 const prefix=`test:creative:${randomUUID()}:`,apps=[],sockets=[];let replacement,admin;
 if(storage==='redis'){admin=new Redis(process.env.REDIS_URL);admin.on('error',()=>{});for(let i=0;i<2;i++)apps.push(createApp({backend:redisBackend(process.env.REDIS_URL,prefix),origins:[origin]}));}
 else apps.push(createApp({databasePath:':memory:',origins:[origin]}));
 const emit=(s,event,payload={})=>s.timeout(15000).emitWithAck(event,payload);
 try{
  await Promise.all(apps.map(async app=>{await app.backend.ready;await new Promise(done=>app.httpServer.listen(0,'127.0.0.1',done));}));
  const first=apps[0].backend,second=(apps[1]||apps[0]).backend;
  const users=[];for(const name of ['alpha','beta','outsider','board_a','board_b'])users.push(await first.store.register(name,name,'creative-test-password'));
  const old=await first.games.create(users[3]);await first.games.join(users[4],old.id);const original=structuredClone(await first.games.get(old.id));
  for(let i=0;i<3;i++){
   const app=apps[i%apps.length],token=await first.store.issue(users[i].id);
   const s=io(`http://127.0.0.1:${app.httpServer.address().port}`,{path:SOCKET_PATH,addTrailingSlash:false,transports:['websocket'],autoConnect:false,reconnection:false,extraHeaders:{Origin:origin,Cookie:`${COOKIE}=${token}`}});
   sockets.push(s);const initial=state(s,()=>true);s.connect();await initial;
  }
  const created=await emit(sockets[0],'room:create',{game,mode:game==='lights'?'coop':'versus'});assert.equal(created.ok,true);const id=created.room.id;
  assert.equal((await emit(sockets[1],'room:join',{id})).ok,true);
  const command={kind:game==='lights'?'toggle':'drop',index:0,column:0,round:0,revision:0};
  assert.equal((await emit(sockets[2],`${game}:action`,command)).ok,false);
  assert.equal((await emit(sockets[0],'game:move',{x:0,y:0})).ok,false);
  assert.equal((await emit(sockets[0],`${game==='lights'?'gravity':'lights'}:action`,command)).ok,false);
  const synced=state(sockets[1],r=>r?.[game]?.revision===1);assert.equal((await emit(sockets[0],`${game}:action`,command)).ok,true);await synced;
  const online=users.slice(0,2).map(u=>u.id),next={...command,index:1,column:1,revision:1};
  const results=await Promise.allSettled([first,second].map(backend=>Promise.resolve().then(()=>backend.games[`${game}Action`](users[1].id,next,online))));
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  const saved=structuredClone(await second.games.get(id));assert.equal(saved[game].revision,2);assert.deepEqual(await first.games.get(old.id),original);
  await assert.rejects(async()=>first.games[`${game}Action`](users[0].id,{...command,revision:2},[users[0].id]),/上线/);
  if(storage==='redis'){
   sockets.forEach(s=>s.disconnect());await Promise.all(apps.map(app=>app.close()));replacement=redisBackend(process.env.REDIS_URL,prefix);await replacement.ready;
   assert.deepEqual((await replacement.games.get(id))[game],saved[game]);
   await replacement.games.resign(users[0].id);await replacement.games.rematch(users[0].id);await replacement.games.rematch(users[1].id);
   assert.equal((await replacement.games.get(id))[game].round,1);
   await assert.rejects(()=>replacement.games[`${game}Action`](users[0].id,command,online),/更新/);
   await replacement.games.leave(users[0].id);assert.deepEqual(await replacement.games.get(old.id),original);
  }else{
   assert.equal((await emit(sockets[0],'game:resign')).ok,true);await emit(sockets[0],'game:rematch');assert.equal((await emit(sockets[1],'game:rematch')).ok,true);
   const closed=state(sockets[1],()=>true,'room:closed');await emit(sockets[0],'room:leave');await closed;assert.deepEqual(await first.games.get(old.id),original);
  }
 }finally{
  sockets.forEach(s=>s.disconnect());for(const app of apps)if(app.httpServer.listening)await app.close();if(replacement)await replacement.close();
  if(admin){let cursor='0';do{const result=await admin.scan(cursor,'MATCH',`${prefix}*`,'COUNT',100);cursor=result[0];if(result[1].length)await admin.del(...result[1]);}while(cursor!=='0');admin.disconnect();}
 }
});
