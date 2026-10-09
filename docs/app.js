import {BlockGame, botScoreAt, BOT_DIFFICULTIES, WIDTH, HEIGHT} from './engine.js';
import {BARRAGE_INTERVAL_MS, leadState, leadReaction, selectBarrage} from './barrage.js';

const $ = id => document.getElementById(id);
const params=new URLSearchParams(location.search);
const roomId=params.get('room');
const ticket=params.get('ticket');
const apiBase=String(window.PK_CONFIG?.API_BASE||'').trim().replace(/\/+$/,'');
const isLocal=['localhost','127.0.0.1'].includes(location.hostname);
const canCallApi=!!(apiBase||isLocal);
const apiPath=path=>(apiBase||'')+path;
const els={
 board:$('board'),next:$('next'),notice:$('notice'),start:$('start'),restart:$('restart'),
 status:$('gameStatus'),score:$('playerScore'),bot:$('botScore'),lines:$('lines'),
 level:$('level'),clock:$('clock'),botRemark:$('botRemark'),difficultyList:$('difficultyList'),
 barrage:$('danmakuLayer'),barrageAccessible:$('barrageAccessible'),
 endOverlay:$('endOverlay'),endPanel:$('endOverlay').querySelector('.end-panel'),
 endHeading:$('endHeading'),endDetail:$('endDetail'),endLine:$('endLine'),
 endSync:$('endSync'),endReplay:$('endReplay'),endKicker:$('endKicker')
};
const cells=[],nextCells=[];
for(let i=0;i<WIDTH*HEIGHT;i++){const c=document.createElement('div');c.className='cell';els.board.append(c);cells.push(c);}
for(let i=0;i<16;i++){const c=document.createElement('div');c.className='next-cell';els.next.append(c);nextCells.push(c);}
const SHAPES={I:[[0,1],[1,1],[2,1],[3,1]],O:[[1,0],[2,0],[1,1],[2,1]],T:[[1,0],[0,1],[1,1],[2,1]],S:[[1,0],[2,0],[0,1],[1,1]],Z:[[0,0],[1,0],[1,1],[2,1]],J:[[0,0],[0,1],[1,1],[2,1]],L:[[2,0],[0,1],[1,1],[2,1]]};
let selectedDifficulty=Object.hasOwn(BOT_DIFFICULTIES,params.get('difficulty'))?params.get('difficulty'):'easy';
let game=new BlockGame(20261008),started=false,busy=false,finished=false,startClock=0,durationMs=90000,actions=[],activeRoom=null,lastRender=0;
let priorLead='tie',nextBarrageAt=BARRAGE_INTERVAL_MS,lastReactionAt=-9000,barrageIndex=0,recentLines=[];
const fmt=n=>Number(n).toLocaleString('zh-CN');
const timeFmt=t=>{const s=Math.ceil(Math.max(0,t)/1000);return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;};
const DIFF_REMARKS={easy:'“先眯一会儿嘛……”',medium:'“这局我要认真了。”',hard:'“逃不掉的，哼哼。”'};
function setDifficultyLocked(locked){
 for(const el of els.difficultyList.querySelectorAll('[data-difficulty]'))el.disabled=locked;
}
function updateDifficulty(){
 for(const el of els.difficultyList.querySelectorAll('[data-difficulty]')){
  const chosen=el.dataset.difficulty===selectedDifficulty;
  el.classList.toggle('is-selected',chosen);
  el.setAttribute('aria-pressed',String(chosen));el.setAttribute('aria-expanded',String(chosen));
 }
 els.botRemark.textContent=DIFF_REMARKS[selectedDifficulty];
 setDifficultyLocked(started||!!activeRoom);
}
function setNotice(message,kind=''){
 els.notice.textContent=message;
 els.notice.className='status-note'+(kind?' '+kind:'')+(message?'':' hidden');
}
function draw(){
 const s=game.snapshot(),visible=s.board.map(row=>row.slice());
 for(const [x,y] of s.active)if(y>=0&&y<HEIGHT&&x>=0&&x<WIDTH)visible[y][x]=s.type;
 for(let i=0;i<cells.length;i++){
  const type=visible[Math.floor(i/WIDTH)][i%WIDTH], wanted=type?`cell filled ${type}`:'cell';
  if(cells[i].className!==wanted)cells[i].className=wanted;
 }
 nextCells.forEach((c,i)=>{
  const filled=SHAPES[s.next]?.some(([x,y])=>x===i%4&&y===Math.floor(i/4));
  c.className=filled?`next-cell cell filled ${s.next}`:'next-cell';
 });
 els.score.textContent=fmt(s.score);els.lines.textContent=s.lines;els.level.textContent=s.level;
 const bot=botScoreAt(Math.min(durationMs,s.elapsedMs),selectedDifficulty);
 els.bot.textContent=fmt(bot);els.clock.textContent=timeFmt(durationMs-s.elapsedMs);
 els.status.textContent=finished?'FINISHED':started?'PLAYING':'READY';
}
function clearBarrage(){
 els.barrage.replaceChildren();els.barrageAccessible.textContent='';
 recentLines=[];barrageIndex=0;priorLead='tie';lastReactionAt=-9000;nextBarrageAt=BARRAGE_INTERVAL_MS;
}
function emitBarrage(kind='idle'){
 if(!started||finished)return;
 const text=selectBarrage(kind,Math.random,recentLines);
 recentLines.push(text);if(recentLines.length>8)recentLines.shift();
 const line=document.createElement('div');line.className='danmaku-line';
 if(kind!=='idle')line.classList.add('reaction');
 if(kind==='playerOvertake'||kind==='botOvertake')line.classList.add('overtake');
 line.style.setProperty('--lane',`${[12,30,48,66][barrageIndex%4]}%`);
 barrageIndex++;
 line.textContent=`达妮娅：${text}`; // safe: always textContent, never HTML
 els.barrage.append(line);els.barrageAccessible.textContent=line.textContent;
 line.addEventListener('animationend',()=>line.remove(),{once:true});
}
function processBarrage(t,playerScore,botScore){
 const lead=leadState(playerScore,botScore);
 if(priorLead!==lead){
  const kind=leadReaction(priorLead,lead);
  if(kind&&t>=1500&&t-lastReactionAt>=4000){emitBarrage(kind);lastReactionAt=t;}
  priorLead=lead;
 }
 if(t>=nextBarrageAt){
  const category=lead==='player'?'playerLead':lead==='bot'?'botLead':'idle';
  emitBarrage(Math.random()<0.58?'idle':category);
  nextBarrageAt=BARRAGE_INTERVAL_MS*(Math.floor(t/BARRAGE_INTERVAL_MS)+1);
 }
}
async function request(path,method='GET',body){
 const r=await fetch(apiPath(path),{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),cache:'no-store'});
 const data=await r.json().catch(()=>({}));
 if(!r.ok)throw new Error(data.error||`HTTP ${r.status}`);
 return data;
}
async function loadRoom(){
 if(!roomId)return; // Public GitHub Pages experience requires no backend.
 if(!ticket){setNotice('房间链接缺少票据。请从 QQ 中打开完整链接。','error');els.start.disabled=true;return;}
 if(!canCallApi){setNotice('尚未配置在线比赛服务器，无法进入此房间。','error');els.start.disabled=true;return;}
 try{
  const data=await request(`/api/rooms/${encodeURIComponent(roomId)}?ticket=${encodeURIComponent(ticket)}`);
  if(data.status==='finished'||data.status==='expired'){
   setNotice(data.status==='finished'?'此房间已结算，不能重复提交。':'比赛房间已过期，请重新创建。','error');els.start.disabled=true;return;
  }
  durationMs=data.durationMs;
  selectedDifficulty=Object.hasOwn(BOT_DIFFICULTIES,data.difficulty)?data.difficulty:'easy';
  activeRoom={id:roomId,ticket};updateDifficulty();els.clock.textContent=timeFmt(durationMs);
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
 if(started||busy||activeRoom&&finished)return;
 busy=true;els.start.disabled=true;
 try{
  let seed=Math.floor(Math.random()*4294967296)>>>0;
  if(activeRoom){
   const d=await request(`/api/rooms/${activeRoom.id}/start`,'POST',{ticket:activeRoom.ticket});
   seed=d.seed;durationMs=d.durationMs;
   selectedDifficulty=Object.hasOwn(BOT_DIFFICULTIES,d.difficulty)?d.difficulty:selectedDifficulty;
  }
  game=new BlockGame(seed);actions=[];finished=false;started=true;clearBarrage();setNotice('');
  els.endOverlay.classList.add('hidden');els.endPanel.className='end-panel';
  startClock=performance.now();lastRender=0;
  els.start.textContent='比赛进行中';els.start.disabled=true;els.restart.disabled=true;
  updateDifficulty();draw();emitBarrage('idle');requestAnimationFrame(tick);
 }catch(e){setNotice('启动失败：'+e.message,'error');els.start.disabled=false;}
 finally{busy=false;}
}
function tick(){
 if(!started||finished)return;
 const t=msNow();
 try{game.advanceTo(t);}catch(e){console.error(e);return;}
 if(t-lastRender>=35){
  draw();lastRender=t;
  const s=game.snapshot();processBarrage(t,s.score,botScoreAt(Math.min(durationMs,t),selectedDifficulty));
 }
 if(t>=durationMs||game.ended){endGame();return;}
 requestAnimationFrame(tick);
}
function outcome(winner,player,bot,detail=''){
 const title=winner==='player'?'玩家获胜！':winner==='bot'?'达妮娅获胜！':'双方平局！';
 els.endOverlay.classList.remove('hidden');
 els.endPanel.className='end-panel '+(winner==='player'?'winner-player':winner==='bot'?'winner-bot':'');
 els.endKicker.textContent='MATCH COMPLETE';els.endHeading.textContent=title;
 els.endDetail.textContent=`玩家 ${fmt(player)} 分 · 达妮娅 ${fmt(bot)} 分`;
 els.endLine.textContent=detail|| (winner==='player'?'诶……真的被你赢了！下次可不一定哦。':winner==='bot'?'哼哼，这一局是我的胜利～':'平手呀，下次一定要分个高下。');
}
async function endGame(){
 if(finished)return;
 finished=true;started=false;
 const t=msNow();game.advanceTo(t);draw();clearBarrage();
 els.start.textContent='本局已结束';els.start.disabled=true;els.restart.disabled=!!activeRoom;
 setDifficultyLocked(!!activeRoom);
 const s=game.snapshot();let bot=botScoreAt(s.elapsedMs,selectedDifficulty);
 let winner=s.score>bot?'player':s.score<bot?'bot':'tie';
 outcome(winner,s.score,bot);
 els.endReplay.disabled=!!activeRoom;
 els.endReplay.textContent=activeRoom?'房间已结束':'再来一局 ↗';
 if(!activeRoom){els.endSync.textContent='本地体验 · 本局成绩不发送到 QQ';return;}
 els.endSync.textContent='正在验证比赛结果……';
 try{
  const data=await request(`/api/rooms/${activeRoom.id}/finish`,'POST',{ticket:activeRoom.ticket,score:s.score,lines:s.lines,elapsedMs:s.elapsedMs,events:actions});
  outcome(data.winner,data.playerScore,data.botScore);
  els.endSync.textContent='服务器已复算并记录 · 此阶段尚未发放 QQ 好感度';
 }catch(e){els.endSync.textContent='结果尚未确认：'+e.message;}
}
function resetRound(){
 if(activeRoom||started||busy)return;
 game=new BlockGame(Math.floor(Math.random()*4294967296));finished=false;clearBarrage();
 els.endOverlay.classList.add('hidden');els.start.textContent='开始挑战 ↗';els.start.disabled=false;els.restart.disabled=true;
 updateDifficulty();draw();
}
for(const button of els.difficultyList.querySelectorAll('[data-difficulty]')){
 button.addEventListener('click',()=>{
  if(started||activeRoom||busy)return;
  const value=button.dataset.difficulty;if(!Object.hasOwn(BOT_DIFFICULTIES,value))return;
  selectedDifficulty=value;updateDifficulty();draw();
 });
}
els.start.addEventListener('click',begin);
els.restart.addEventListener('click',resetRound);
els.endReplay.addEventListener('click',async()=>{if(activeRoom)return;resetRound();await begin();});
const keymap={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'rotate',ArrowDown:'down',Space:'drop',' ':'drop',a:'left',d:'right',w:'rotate',s:'down'};
window.addEventListener('keydown',e=>{const action=keymap[e.code]||keymap[e.key];if(action){e.preventDefault();if(e.repeat&&action==='drop')return;apply(action);}});
for(const action of ['left','right','rotate','down','drop']){
 const button=$(action);
 button.addEventListener('pointerdown',e=>{e.preventDefault();apply(action);});
 button.addEventListener('contextmenu',e=>e.preventDefault());
}
updateDifficulty();draw();loadRoom();
