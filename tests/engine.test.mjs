import test from 'node:test';
import assert from 'node:assert/strict';
import {BlockGame,replay,botScoreAt,botScoreEventsUntil} from '../docs/engine.js';
test('seed replay deterministic and scores agree',()=>{
 const seed=12345, game=new BlockGame(seed), events=[];
 const add=(a,t)=>{game.input(a,t);events.push({a,t});};
 add('left',120);add('rotate',230);add('right',300);add('drop',600);add('left',750);add('down',800);add('drop',920);
 game.advanceTo(4000);
 const snapshot=replay(seed,events,4000);
 assert.equal(snapshot.score,game.score);
 assert.deepEqual(snapshot.board,game.board);
 assert.equal(snapshot.lines,game.lines);
 assert.equal(snapshot.next,game.next);
});
test('replay rejects spoofed and out-of-order moves',()=>{
 assert.throws(()=>replay(2,[{a:'drop',t:100},{a:'drop',t:125}],2000),/Implausible/);
 assert.throws(()=>replay(2,[{a:'rotate',t:500},{a:'left',t:250}],2000),/Bad action/);
 assert.throws(()=>replay(2,[{a:'win',t:200}],2000),/Bad action/);
});
test('initial state and bot points',()=>{
 const game=new BlockGame(1);assert.equal(game.board.length,20);assert.equal(game.board[0].length,10);
 assert.equal(game.score,0);assert.equal(botScoreAt(0),0);assert(botScoreAt(90000)>0);
});

test('Daniya scores only every 1.5-3 seconds, with realistic step changes',()=>{
 const events=botScoreEventsUntil(90000);
 assert(events.length>=30&&events.length<=60,`Unexpected pieces: ${events.length}`);
 assert.equal(botScoreAt(0),0);
 for(let i=0;i<events.length;i++){
   const event=events[i],prior=i?events[i-1]:{at:0,score:0};
   assert(event.at-prior.at>=1500&&event.at-prior.at<=3000);
   assert.equal(botScoreAt(event.at-1),prior.score,'Score must remain still until next drop');
   assert.equal(botScoreAt(event.at),event.score);
   assert(event.delta>0&&event.delta<=333,'Score jump must look like plausible block/line points');
   assert([0,100,300].includes(event.clearBonus));
   assert.equal(event.score-prior.score,event.delta);
 }
 assert(botScoreAt(90000)>300&&botScoreAt(90000)<2200);
 assert.equal(botScoreAt(90000),botScoreAt(90000),'Both clients reproduce the same result');
});
