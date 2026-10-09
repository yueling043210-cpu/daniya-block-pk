import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {BARRAGE,BARRAGE_TOTAL,BARRAGE_INTERVAL_MS,leadReaction,leadState,selectBarrage} from '../docs/barrage.js';
const page=fs.readFileSync(new URL('../docs/index.html',import.meta.url),'utf8');
const script=fs.readFileSync(new URL('../docs/app.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../docs/style.css',import.meta.url),'utf8');
test('final UI keeps scoreboard at the top and removes abandoned sections',()=>{
 assert(page.indexOf('class="scoreboard"')>0);
 assert(page.indexOf('class="scoreboard"')<page.indexOf('class="arena"'));
 assert(!/class="(?:masthead|hero|results|rules|voice|difficulty-panel)"/.test(page));
 assert(!/<footer\b/i.test(page));
 assert.equal(page.split('id="botScore"').length,2);
 assert(page.includes('DENIA · 达妮娅'));
 assert(page.includes('id="endOverlay"')&&page.includes('id="endReplay"'));
 assert(page.indexOf('id="endOverlay"')<page.indexOf('id="left"'));
 assert(page.indexOf('id="drop"')<page.indexOf('id="barrageAccessible"'));
});
test('three accordion difficulty options are selectable and described',()=>{
 for(const [id,label] of [['easy','犯困的水蜜桃'],['medium','认真的娅娅'],['hard','终极邪恶水蜜桃']]){
  assert(page.includes(`data-difficulty="${id}"`));assert(page.includes(label));
 }
 assert.equal((page.match(/class="diff-choice/g)||[]).length,3);
 assert(script.includes('updateDifficulty()')&&script.includes('button.disabled=locked')===false);
 assert(css.includes('.diff-choice.is-selected .diff-description{display:block}'));
});
test('dialogue pool, interval and lead changes are deterministic and safe',()=>{
 assert(BARRAGE_TOTAL>=30);
 assert.equal(BARRAGE_INTERVAL_MS,8000);
 assert.equal(leadState(100,0),'player');assert.equal(leadState(5,12),'bot');assert.equal(leadState(12,12),'tie');
 assert.equal(leadReaction('bot','player'),'playerOvertake');
 assert.equal(leadReaction('player','bot'),'botOvertake');
 assert.equal(leadReaction('tie','player'),'playerLead');
 assert.equal(leadReaction('tie','bot'),'botLead');
 assert.equal(leadReaction('bot','bot'),null);
 assert.notEqual(selectBarrage('idle',()=>0,[BARRAGE.idle[0]]),BARRAGE.idle[0]);
 assert.equal(selectBarrage('unknown',()=>0),BARRAGE.idle[0]);
 assert(script.includes('textContent=`达妮娅：${text}`'));
 assert(!script.includes('innerHTML'));
 assert(css.includes('pointer-events:none'));
});
test('result centered in playfield with server result reporting intact',()=>{
 assert(page.includes('class="board-stage"'));
 assert(css.includes('.end-overlay{position:absolute;inset:0'));
 assert(script.includes('/finish'));
 assert(script.includes('data.winner'));
 assert(script.includes('服务器已复算并记录'));
 assert(script.includes("els.endOverlay.classList.remove('hidden')"));
 assert(!page.includes('MATCH RESULT'));
});
