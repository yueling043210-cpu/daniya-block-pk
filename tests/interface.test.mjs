import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {BARRAGE,BARRAGE_TOTAL,BARRAGE_INTERVAL_MS,leadReaction,leadState,selectBarrage} from '../docs/barrage.js';
const page=fs.readFileSync(new URL('../docs/index.html',import.meta.url),'utf8');
const script=fs.readFileSync(new URL('../docs/app.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../docs/style.css',import.meta.url),'utf8');
test('compact scoreboard-only layout, no bottom duplicate start/restart bar',()=>{
 assert(page.indexOf('class="scoreboard"')>0);
 assert(page.indexOf('class="scoreboard"')<page.indexOf('class="arena"'));
 assert(page.includes('DENIA · 达妮娅'));
 assert(!page.includes('class="actionbar"'));
 assert(!page.includes('id="restart"'));
 assert(!page.includes('id="danmakuLayer"'));
 assert(!page.includes('MATCH RESULT'));
 assert(page.includes('id="readyOverlay"')&&page.includes('id="start"'));
 assert(page.includes('>开始挑战</button>'));
 assert(!page.includes('PLAYFIELD'));
 assert(!page.includes('id="gameStatus"'));
 assert(!page.includes('class="hint"'));
 assert(!page.includes('方向键移动'));
 assert(!page.includes('开始挑战 ↗'));
 assert(!page.includes('测试版本')); 
 assert(page.includes('id="endOverlay"')&&page.includes('id="endReplay"'));
 assert(page.indexOf('id="endOverlay"')<page.indexOf('id="left"'));
});
test('one real dropdown with three descriptions and neutral unselected edge',()=>{
 assert(page.includes('<select id="difficultySelect"'));
 for(const [id,name] of [['easy','犯困的水蜜桃'],['medium','认真的娅娅'],['hard','终极邪恶水蜜桃']]){
  assert(page.includes(`<option value="${id}"`)); assert(page.includes(name));
 }
 assert.equal((page.match(/<option value="/g)||[]).length,3);
 assert(!page.includes('class="diff-choice'));
 assert(css.includes('.difficulty-select:disabled'));
 assert(css.includes('.difficulty-drawer{background:#181d32;border:1px solid #303651'));
 assert(script.includes('setDifficultyLocked(started||finished||busy||!!activeRoom)'));
});
test('live commentary is vertical bounded log beneath difficulty and uses safe text',()=>{
 assert(page.indexOf('class="chat-panel"')>page.indexOf('class="difficulty-drawer"'));
 assert(page.includes('id="chatFeed"')&&page.includes('role="log"'));
 assert(css.includes('.chat-feed>.chat-msg:first-child{margin-top:auto'));
 assert(css.includes('.chat-panel{flex:1 1 0'));
 assert(css.includes('.board-stage{width:min(100%,535px)')); 
 assert(css.includes('overflow-y:auto'));
 assert(css.includes('animation:chat-rise'));
 assert(script.includes('els.chatFeed.scrollTop=els.chatFeed.scrollHeight'));
 assert(!script.includes('gameStatus'));
 assert(!script.includes('本地体验 · 本局成绩不发送到 QQ')); 
 assert(script.includes('content.textContent=text'));
 assert(!script.includes('innerHTML'));
 assert(BARRAGE_TOTAL>=30);assert.equal(BARRAGE_INTERVAL_MS,8000);
 assert.equal(leadState(100,0),'player');assert.equal(leadState(5,12),'bot');
 assert.equal(leadReaction('bot','player'),'playerOvertake');
 assert.equal(leadReaction('player','bot'),'botOvertake');
 assert.notEqual(selectBarrage('idle',()=>0,[BARRAGE.idle[0]]),BARRAGE.idle[0]);
});
test('center winner modal freezes result and retains server finish integration',()=>{
 assert(page.includes('class="board-stage"'));
 assert(css.includes('.end-overlay{position:absolute;inset:0'));
 assert(script.includes('finalResult=Object.freeze'));
 assert(script.includes('setDifficultyLocked(true);draw()'));
 assert(script.includes('/finish'));
 assert(script.includes('data.winner'));
 assert(script.includes('服务器已复算并记录'));
 assert(script.includes("els.endOverlay.classList.remove('hidden')"));
});
