import {BlockGame, botScoreAt, WIDTH, HEIGHT} from './engine.js';

const $ = id => document.getElementById(id);
const params=new URLSearchParams(location.search);
const roomId=params.get('room');
const ticket=params.get('ticket');
const apiBase=String(window.PK_CONFIG?.API_BASE||'').trim().replace(/\/+$/,'');
const isLocal=['localhost','127.0.0.1'].includes(location.hostname);
const canCallApi=!!(apiBase||isLocal);
const apiPath=path=>(apiBase||'')+path;
const els={board:$('board'),next:$('next'),notice:$('notice'),mode:$('modeBadge'),start:$('start'),restart:$('restart'),status:$('gameStatus'),score:$('playerScore'),bot:$('botScore'),lines:$('lines'),level:$('level'),clock:$('clock'),voice:$('voice'),results:$('results'),heading:$('resultHeading'),detail:$('resultDetail'),sync:$('resultSync')};
const colors=['I','O','T','S','Z','J','L'];
const cells=[],nextCells=[];
for(let i=0;i<WIDTH*HEIGHT;i++){const c=document.createElement('div');c.className='cell';els.board.append(c);cells.push(c);}
for(let i=0;i<16;i++){const c=document.createElement('div');c.className='next-cell';els.next.append(c);nextCells.push(c);}
const SHAPES={I:[[0,1],[1,1],[2,1],[3,1]],O:[[1,0],[2,0],[1,1],[2,1]],T:[[1,0],[0,1],[1,1],[2,1]],S:[[1,0],[2,0],[0,1],[1,1]],Z:[[0,0],[1,0],[1,1],[2,1]],J:[[0,0],[0,1],[1,1],[2,1]],L:[[2,0],[0,1],[1,1],[2,1]]};
let game=new BlockGame(20261008), started=false, busy=false, finished=false, startClock=0, durationMs=90000, actions=[], activeRoom=null, lastRender=0;
const fmt=n=>n.toLocaleString('zh-CN');
const timeFmt=t=>{const s=Math.ceil(Math.max(0,t)/1000);return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;};
function setNotice(message,kind='') {els.notice.textContent=message;els.notice.className='notice '+kind;}
function draw(){
 const s=game.snapshot();
 const visible=s.board.map(r=>r.slice());
 for(const [x,y] of s.active){if(y>=0&&y<HEIGHT&&x>=0&&x<WIDTH)visible[y][x]=s.type;}
 for(let i=0;i<cells.length;i++){
   const type=visible[Math.floor(i/WIDTH)][i%WIDTH];const wanted=type?`cell filled ${type}`:'cell';
   if(cells[i].className!==wanted)cells[i].className=wanted;
 }
 nextCells.forEach((c,i)=>{const filled=SHAPES[s.next]?.some(([x,y])=>x===i%4&&y===Math.floor(i/4));c.className=filled?`next-cell cell filled ${s.next}`:'next-cell';});
 els.score.textContent=fmt(s.score);els.lines.textContent=s.lines;els.level.textContent=s.level;
 const bot=botScoreAt(Math.min(durationMs,s.elapsedMs));els.bot.textContent=fmt(bot);
 els.clock.textContent=timeFmt(durationMs-s.elapsedMs);
 els.status.textContent=finished?'FINISHED':started?'PLAYING':'READY';
 els.voice.textContent=finished?(s.score>bot?'诶……居然真的赢了我！':'哼哼，这次是我赢了哦。'):s.score>bot?'怎么突然追上来了……？':'要认真一点哦，我可是不会放水的。';
}
function setMode(connected){els.mode.className=connected?'mode live':'mode';els.mode.textContent=connected?'房间通信模式':'体验模式';}
async function request(path,method='GET',body){
 const r=await fetch(apiPath(path),{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),cache:'no-store'});
 const data=await r.json().catch(()=>({}));
 if(!r.ok)throw new Error(data.error||`HTTP ${r.status}`);
 return data;
}
async function loadRoom(){
 if(!roomId){setMode(false);setNotice('体验模式：你可以直接玩方块，但成绩只保存在本次网页中，不会发送到 QQ。');return;}
 if(!ticket){setNotice('房间链接缺少票据，请从机器人发送的完整链接打开。','error');els.start.disabled=true;return;}
 if(!canCallApi){setNotice('这个页面尚未配置 HTTPS 比赛服务器。需要先部署后端，再修改 docs/config.js 的 API_BASE。','error');els.start.disabled=true;return;}
 try{
   const data=await request(`/api/rooms/${encodeURIComponent(roomId)}?ticket=${encodeURIComponent(ticket)}`);
   if(data.status==='finished'){setNotice('此房间已经结算，不能重复提交。','error');els.start.disabled=true;return;}
   if(data.status==='expired'){setNotice('房间已过期，请重新从 QQ 创建。','error');els.start.disabled=true;return;}
   durationMs=data.durationMs;
   activeRoom={id:roomId,ticket};
   setMode(true);setNotice(`已连接比赛服务器 · ${data.playerName||'玩家'} · ${Math.round(durationMs/1000)} 秒 · 本阶段不发送好感度。`,'success');
   els.clock.textContent=timeFmt(durationMs);
 }catch(e){setNotice('无法读取比赛房间：'+e.message,'error');els.start.disabled=true;}
}
function msNow(){return Math.min(durationMs,Math.max(0,Math.floor(performance.now()-startClock)));}
function apply(action){
 if(!started||finished||busy)return;
 const t=msNow();
 if(t>=durationMs){endGame();return;}
 try{game.input(action,t);actions.push({a:action,t});draw();if(game.ended)endGame();}catch(e){console.error(e);}
}
async function begin(){
 if(started||busy)return;
 busy=true;els.start.disabled=true;
 try{
   let seed=(Math.floor(Math.random()*4294967296))>>>0;
   if(activeRoom){
     const d=await request(`/api/rooms/${activeRoom.id}/start`,'POST',{ticket:activeRoom.ticket});
     seed=d.seed;durationMs=d.durationMs;
   }
   game=new BlockGame(seed);actions=[];finished=false;started=true;
   startClock=performance.now();els.results.classList.add('hidden');els.start.textContent='比赛进行中';els.restart.disabled=true;draw();
   requestAnimationFrame(tick);
 }catch(e){setNotice('启动失败：'+e.message,'error');els.start.disabled=false;}
 finally{busy=false;}
}
function tick(stamp){
 if(!started||finished)return;
 const t=msNow();
 try{game.advanceTo(t);}catch(e){console.error(e);return;}
 if(t-lastRender>35){draw();lastRender=t;}
 if(t>=durationMs||game.ended){endGame();return;}
 requestAnimationFrame(tick);
}
async function endGame(){
 if(finished)return;
 finished=true;started=false;
 const t=msNow();
 game.advanceTo(t);draw();els.start.textContent='本局已结束';els.restart.disabled=!!activeRoom;
 const s=game.snapshot();let bot=botScoreAt(s.elapsedMs);
 let winner=s.score>bot?'player':s.score<bot?'bot':'tie';
 els.results.classList.remove('hidden');els.heading.textContent=winner==='player'?'你赢了，达妮娅！':winner==='bot'?'达妮娅获胜！':'双方平局！';
 els.detail.textContent=`玩家 ${fmt(s.score)} 分 / 达妮娅 ${fmt(bot)} 分 / 消除 ${s.lines} 行`;
 if(!activeRoom){els.sync.textContent='仅体验模式：没有传分，也没有好感度奖励。';return;}
 els.sync.textContent='正在向游戏服务器提交可重放操作记录……';
 try{
   const data=await request(`/api/rooms/${activeRoom.id}/finish`,'POST',{
     ticket:activeRoom.ticket,score:s.score,lines:s.lines,elapsedMs:s.elapsedMs,events:actions
   });
   bot=data.botScore;winner=data.winner;
   els.heading.textContent=winner==='player'?'你赢了，达妮娅！':winner==='bot'?'达妮娅获胜！':'双方平局！';
   els.detail.textContent=`已记录：玩家 ${fmt(data.playerScore)} 分 · 达妮娅 ${fmt(bot)} 分`;
   els.sync.textContent='服务器收到并复算操作记录 ✓ · 这是通信测试成绩，尚未验证 QQ 身份或发放好感度。';
   setNotice('比赛结果已传至服务器。QQ Bridge 还需要单独轮询接收测试。','success');
 }catch(e){els.sync.textContent='服务器未确认结果：'+e.message+'。本局不能当作正式成绩。';setNotice('比赛结束，但通信失败。请检查 API 与服务器日志。','error');}
}
els.start.addEventListener('click',begin);
els.restart.addEventListener('click',()=>{if(activeRoom)return;started=false;finished=false;game=new BlockGame(Math.floor(Math.random()*4294967296));els.results.classList.add('hidden');els.start.textContent='开始挑战 ↗';els.start.disabled=false;els.restart.disabled=true;draw();});
const keymap={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'rotate',ArrowDown:'down',Space:'drop',' ':'drop',a:'left',d:'right',w:'rotate',s:'down'};
window.addEventListener('keydown',e=>{const action=keymap[e.code]||keymap[e.key];if(action){e.preventDefault();if(e.repeat&&action==='drop')return;apply(action);}});
for(const action of ['left','right','rotate','down','drop']){
 const button=$(action);
 button.addEventListener('pointerdown',e=>{e.preventDefault();apply(action);});
 button.addEventListener('contextmenu',e=>e.preventDefault());
}
setMode(false);draw();loadRoom();
