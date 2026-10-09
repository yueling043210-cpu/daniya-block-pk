import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {BARRAGE,BARRAGE_TOTAL,leadEvent,selectBarrage} from '../docs/barrage.js';
const counts={idle:30,playerLead:6,botLead:8,playerOvertake:7,botOvertake:6,tie:3,topout:4,playerWin:3,botWin:2};
test('approved V2 has exactly 69 lines, all non-empty, brief, and safely printable',()=>{
 assert.deepEqual(Object.fromEntries(Object.entries(BARRAGE).map(([k,v])=>[k,v.length])),counts);
 assert.equal(BARRAGE_TOTAL,69);
 for(const [category,lines] of Object.entries(BARRAGE)){
  assert.equal(new Set(lines).size,lines.length,category+' contains duplicate commentary');
  for(const line of lines){assert.equal(typeof line,'string');assert(line.length>0&&line.length<65,category+': '+line);assert(!line.endsWith('。'));}
 }
 assert.equal(BARRAGE.playerWin[2],'偶尔犯点小错误，才能显得更好接近哦');
 assert.equal(BARRAGE.botWin[1],'诶，结束了？那胜利就归我咯');
});
test('tie preserves prior leader when deciding whether next lead is an overtake',()=>{
 assert.equal(leadEvent('player','tie','player'),'tie');
 assert.equal(leadEvent('tie','bot','player'),'botOvertake');
 assert.equal(leadEvent('bot','tie','bot'),'tie');
 assert.equal(leadEvent('tie','player','bot'),'playerOvertake');
 assert.equal(leadEvent('tie','player','tie'),'playerLead');
 assert.equal(leadEvent('player','player','bot'),null);
 assert(BARRAGE.playerWin.includes(selectBarrage('playerWin',()=>0)));
});
test('ending overlay does not duplicate scoreboard values or enable restart',()=>{
 const page=fs.readFileSync(new URL('../docs/index.html',import.meta.url),'utf8');
 const app=fs.readFileSync(new URL('../docs/app.js',import.meta.url),'utf8');
 assert(!page.includes('id="endDetail"'));
 assert(!page.includes('MATCH COMPLETE'));
 assert(!page.includes('id="endReplay"'));
 assert(!app.includes('els.endDetail'));
 assert(app.includes("postEndingBarrage(winner,topOut)"));
 assert(app.includes("postEndingBarrage(data.winner,!!data.topOut)"));
 assert(app.includes("topOut?'topout':winner==='player'?'playerWin'"));
 assert(app.includes("if(!activeRoom){postEndingBarrage(winner,topOut);return;}"));
});
