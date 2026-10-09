import {BlockGame,botScoreAt,BOT_DIFFICULTIES,resolveWinner,WIDTH,HEIGHT} from './engine.js?v=024';
import {BARRAGE_INTERVAL_MS,leadState,leadEvent,selectBarrage} from './barrage.js?v=025';

const $=id=>document.getElementById(id);
const params=new URLSearchParams(location.search);
const roomId=params.get('room'),ticket=params.get('ticket');
const apiBase=String(window.PK_CONFIG?.API_BASE||'').trim().replace(/\/+$/,'');
const isLocal=['localhost','127.0.0.1'].includes(location.hostname);
const canCallApi=!!(apiBase||isLocal);
function browserSessionId(){
 // A separate browser tab/device uses a separate claim; previews never claim a room.
 const key='daniya-pk-room-client-'+String(roomId||'');
 try {
  let id=sessionStorage.getItem(key);
  if(!id){id=Array.from(crypto.getRandomValues(new Uint8Array(24)),b=>b.toString(16).padStart(2,'0')).join('');sessionStorage.setItem(key,id);}
  return id;
 }catch{
  if(!window.__pkTempClient)window.__pkTempClient=Array.from(crypto.getRandomValues(new Uint8Array(24)),b=>b.toString(16).padStart(2,'0')).join('');
  return window.__pkTempClient;
 }
}
const apiPath=path=>(apiBase||'')+path;
const els={
 board:$('board'),next:$('next'),notice:$('notice'),start:$('start'),readyOverlay:$('readyOverlay'),
 score:$('playerScore'),bot:$('botScore'),lines:$('lines'),
 level:$('level'),clock:$('clock'),botRemark:$('botRemark'),
 difficultySelect:$('difficultySelect'),chatFeed:$('chatFeed'),
 endOverlay:$('endOverlay'),endPanel:$('endOverlay').querySelector('.end-panel'),
 endHeading:$('endHeading')
};
const cells=[],nextCells=[];
for(let i=0;i<WIDTH*HEIGHT;i++){const c=document.createElement('div');c.className='cell';els.board.append(c);cells.push(c);}
for(let i=0;i<16;i++){const c=document.createElement('div');c.className='next-cell';els.next.append(c);nextCells.push(c);}
const SHAPES={I:[[0,1],[1,1],[2,1],[3,1]],O:[[1,0],[2,0],[1,1],[2,1]],T:[[1,0],[0,1],[1,1],[2,1]],S:[[1,0],[2,0],[0,1],[1,1]],Z:[[0,0],[1,0],[1,1],[2,1]],J:[[0,0],[0,1],[1,1],[2,1]],L:[[2,0],[0,1],[1,1],[2,1]]};
let selectedDifficulty=Object.hasOwn(BOT_DIFFICULTIES,params.get('difficulty'))?params.get('difficulty'):'easy';
let game=new BlockGame(20261008),started=false,busy=false,finished=false,startClock=0,durationMs=90000,actions=[],activeRoom=null,lastRender=0;
let finalResult=null;
let roomClientId=null;
let priorLead='tie',lastDecisiveLead='tie',nextChatAt=BARRAGE_INTERVAL_MS,lastReactionAt=-9000,recentLines=[];
const fmt=n=>Number(n).toLocaleString('zh-CN');
const timeFmt=t=>{const s=Math.ceil(Math.max(0,t)/1000);return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;};
const DIFF_REMARKS={easy:'“先眯一会儿嘛……”',medium:'“这局我要认真了。”',hard:'“逃不掉的，哼哼。”'};
function setDifficultyLocked(locked){els.difficultySelect.disabled=!!locked;}
function updateDifficulty(){
 els.difficultySelect.value=selectedDifficulty;
 els.botRemark.textContent=DIFF_REMARKS[selectedDifficulty];
 setDifficultyLocked(started||finished||busy||!!activeRoom);
}
function setNotice(message,kind=''){
 els.notice.textContent=message;
 els.notice.className='status-note'+(kind?' '+kind:'')+(message?'':' hidden');
}
function currentBotScore(ms){
 return botScoreAt(Math.min(durationMs,ms),selectedDifficulty,game.seed);
}
function draw(){
 const s=game.snapshot(),visible=s.board.map(row=>row.slice());
 for(const [x,y] of s.active)if(y>=0&&y<HEIGHT&&x>=0&&x<WIDTH)visible[y][x]=s.type;
 for(let i=0;i<cells.length;i++){
  const type=visible[Math.floor(i/WIDTH)][i%WIDTH],wanted=type?`cell filled ${type}`:'cell';
  if(cells[i].className!==wanted)cells[i].className=wanted;
 }
 nextCells.forEach((c,i)=>{
  const filled=SHAPES[s.next]?.some(([x,y])=>x===i%4&&y===Math.floor(i/4));
  c.className=filled?`next-cell cell filled ${s.next}`:'next-cell';
 });
 els.score.textContent=fmt(finalResult?.playerScore??s.score);
 els.lines.textContent=s.lines;els.level.textContent=s.level;
 els.bot.textContent=fmt(finalResult?.botScore??currentBotScore(s.elapsedMs));
 els.clock.textContent=timeFmt(durationMs-s.elapsedMs);
}
function resetChat(){
 els.chatFeed.replaceChildren();recentLines=[];priorLead='tie';lastDecisiveLead='tie';lastReactionAt=-9000;nextChatAt=BARRAGE_INTERVAL_MS;
}
function postChat(kind='idle',{force=false}={}){
 if((!started||finished)&&!force)return;
 const text=selectBarrage(kind,Math.random,recentLines);
 recentLines.push(text);if(recentLines.length>8)recentLines.shift();
 const item=document.createElement('div');item.className='chat-msg';
 if(kind!=='idle')item.classList.add('reaction');
 if(kind==='playerOvertake'||kind==='botOvertake')item.classList.add('overtake');
 const name=document.createElement('span');name.className='chat-name';name.textContent='达妮娅';
 const content=document.createElement('span');content.textContent=text;
 item.append(name,content);els.chatFeed.append(item);
 while(els.chatFeed.children.length>18)els.chatFeed.children[0].remove();
 // Always scroll down to the newest message, like a bounded livestream chat.
 els.chatFeed.scrollTop=els.chatFeed.scrollHeight;
}
function processChat(t,playerScore,botScore){
 const lead=leadState(playerScore,botScore);
 if(priorLead!==lead){
  const kind=leadEvent(priorLead,lead,lastDecisiveLead);
  if(kind&&t>=1500&&t-lastReactionAt>=4000){postChat(kind);lastReactionAt=t;}
  priorLead=lead;
  if(lead!=='tie')lastDecisiveLead=lead;
 }
 if(t>=nextChatAt){
  const category=lead==='player'?'playerLead':lead==='bot'?'botLead':'idle';
  postChat(Math.random()<0.58?'idle':category);
  nextChatAt=BARRAGE_INTERVAL_MS*(Math.floor(t/BARRAGE_INTERVAL_MS)+1);
 }
}
async function request(path,method='GET',body){
 const r=await fetch(apiPath(path),{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),cache:'no-store'});
 const data=await r.json().catch(()=>({}));
 if(!r.ok)throw new Error(data.error||`HTTP ${r.status}`);
 return data;
}
async function loadRoom(){
 if(!roomId)return;
 if(!ticket){setNotice('房间链接缺少票据。请从 QQ 中打开完整链接。','error');els.start.disabled=true;return;}
 if(!canCallApi){setNotice('尚未配置在线比赛服务器，无法进入此房间。','error');els.start.disabled=true;return;}
 try{
  roomClientId=browserSessionId();
  const data=await request(`/api/rooms/${encodeURIComponent(roomId)}?ticket=${encodeURIComponent(ticket)}&clientId=${encodeURIComponent(roomClientId)}`);
  if(['finished','expired','invalid','playing'].includes(data.status)){
   const messages={finished:'此房间已结算。',expired:'30 秒入场时间已结束，房间作废。',invalid:'检测到多个游戏会话，本局成绩无效。',playing:'此房间已经被使用。'};
   setNotice(messages[data.status],'error');els.start.disabled=true;return;
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
 if(started||busy||finished)return;
 busy=true;els.start.disabled=true;setDifficultyLocked(true);
 try{
  let seed=Math.floor(Math.random()*4294967296)>>>0;
  if(activeRoom){
   roomClientId ||= browserSessionId();
   const d=await request(`/api/rooms/${activeRoom.id}/start`,'POST',{ticket:activeRoom.ticket,clientId:roomClientId});
   seed=d.seed;durationMs=d.durationMs;
   selectedDifficulty=Object.hasOwn(BOT_DIFFICULTIES,d.difficulty)?d.difficulty:selectedDifficulty;
  }
  game=new BlockGame(seed);actions=[];finished=false;finalResult=null;started=true;resetChat();setNotice('');
  els.readyOverlay.classList.add('hidden');els.endOverlay.classList.add('hidden');els.endPanel.className='end-panel';
  startClock=performance.now();lastRender=0;
  updateDifficulty();draw();postChat('idle');requestAnimationFrame(tick);
 }catch(e){setNotice('启动失败：'+e.message,'error');els.start.disabled=false;setDifficultyLocked(!!activeRoom);}
 finally{busy=false;}
}
function tick(){
 if(!started||finished)return;
 const t=msNow();
 try{game.advanceTo(t);}catch(e){console.error(e);return;}
 if(t-lastRender>=35){
  draw();lastRender=t;
  const s=game.snapshot();processChat(t,s.score,currentBotScore(t));
 }
 if(t>=durationMs||game.ended){endGame();return;}
 requestAnimationFrame(tick);
}
function outcome(winner){
 // The scoreboard already shows the two scores; the centered ending modal only shows the result.
 const title=winner==='player'?'玩家获胜！':winner==='bot'?'达妮娅获胜！':'双方平局！';
 els.endOverlay.classList.remove('hidden');
 els.endPanel.className='end-panel '+(winner==='player'?'winner-player':winner==='bot'?'winner-bot':'');
 els.endHeading.textContent=title;
}
function postEndingBarrage(winner,topOut){
 // One ending category per match. Top-out overrides ordinary winner chatter.
 const kind=topOut?'topout':winner==='player'?'playerWin':winner==='bot'?'botWin':null;
 if(kind)postChat(kind,{force:true});
}
async function endGame(){
 if(finished)return;
 const t=msNow();game.advanceTo(t);
 const s=game.snapshot();
 const bot=currentBotScore(s.elapsedMs);
 const topOut=!!s.ended;
 const winner=resolveWinner(s.score,bot,topOut);
 // For online rooms, delay the terminal line until the server validates the match.
 finished=true;started=false;
 finalResult=Object.freeze({playerScore:s.score,botScore:bot,difficulty:selectedDifficulty,seed:game.seed,winner,topOut});
 setDifficultyLocked(true);draw(); // freeze both displayed scores immediately
 outcome(winner);
 if(!activeRoom){postEndingBarrage(winner,topOut);return;}
 setNotice('正在上传比赛结果……');
 try{
  const data=await request(`/api/rooms/${activeRoom.id}/finish`,'POST',{ticket:activeRoom.ticket,clientId:roomClientId,score:s.score,lines:s.lines,elapsedMs:s.elapsedMs,events:actions});
  finalResult=Object.freeze({...finalResult,playerScore:data.playerScore,botScore:data.botScore,winner:data.winner,topOut:!!data.topOut});
  draw();outcome(data.winner);postEndingBarrage(data.winner,!!data.topOut);
  setNotice('比赛结果已上传并通过复算（QQ 反馈尚未接入）。','success');
 }catch(e){
  const invalid=/multiple browser|multiple.*session|room not in progress|room.*invalid|room expired|already finished/i.test(e.message);
  els.endPanel.className='end-panel';
  els.endHeading.textContent=invalid?'本局无效':'成绩未确认';
  setNotice((invalid?'检测到多人访问或房间失效，比分不计入正式成绩。':'无法确认成绩已上传，比分不计入正式成绩。')+' 原因：'+e.message,'error');
 }
}
els.difficultySelect.addEventListener('change',()=>{
 if(started||finished||activeRoom||busy){els.difficultySelect.value=selectedDifficulty;return;}
 const value=els.difficultySelect.value;
 if(!Object.hasOwn(BOT_DIFFICULTIES,value)){els.difficultySelect.value=selectedDifficulty;return;}
 selectedDifficulty=value;updateDifficulty();draw();
});
els.start.addEventListener('click',begin);
const keymap={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'rotate',ArrowDown:'down',Space:'drop',' ':'drop',a:'left',d:'right',w:'rotate',s:'down'};
window.addEventListener('keydown',e=>{const action=keymap[e.code]||keymap[e.key];if(action){e.preventDefault();if(e.repeat&&action==='drop')return;apply(action);}});
for(const action of ['left','right','rotate','down','drop']){
 const button=$(action);
 button.addEventListener('pointerdown',e=>{e.preventDefault();apply(action);});
 button.addEventListener('contextmenu',e=>e.preventDefault());
}
updateDifficulty();draw();loadRoom();
