import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BlockGame,replay,botScoreAt,botScoreEventsUntil,
  BOT_DIFFICULTIES,BOT_DIFFICULTY_NAMES
} from '../docs/engine.js';

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

// v0.2.6 intentionally replaced the old piece/line-based bot simulator with
// a score-only opponent. The v0.1.3 test for minPps/maxPps, pieces, lines,
// clearBonus and hard > 10 * medium was obsolete and prevented safe publishing.
test('Daniya has three seeded difficulty presets with 1.9-2.8s visual updates',()=>{
 assert.deepEqual(BOT_DIFFICULTY_NAMES,['easy','medium','hard']);
 const minute={};
 for(const name of BOT_DIFFICULTY_NAMES){
   const cfg=BOT_DIFFICULTIES[name];
   assert(Number.isFinite(cfg.minScorePerMinute)&&Number.isFinite(cfg.maxScorePerMinute));
   assert(cfg.minScorePerMinute>0&&cfg.maxScorePerMinute>cfg.minScorePerMinute);
   const events=botScoreEventsUntil(60000,name,123456);
   assert(events.length>=20&&events.length<=32,`${name} ticks: ${events.length}`);
   let prior={at:0,score:0};
   for(const event of events){
     assert(event.at-prior.at>=1900&&event.at-prior.at<=2800,`${name} cadence`);
     assert.equal(botScoreAt(event.at-1,name,123456),prior.score,`${name} no intermediate score jumps`);
     assert.equal(botScoreAt(event.at,name,123456),event.score);
     assert(Number.isInteger(event.delta)&&event.delta>0,`${name} positive integer delta`);
     assert.equal(event.score-prior.score,event.delta);
     prior=event;
   }
   minute[name]=prior.score;
   assert.equal(prior.score,botScoreAt(60000,name,123456));
   assert.deepEqual(events,botScoreEventsUntil(60000,name,123456),'seeded replay deterministic');
 }
 assert(minute.easy<minute.medium&&minute.medium<minute.hard,'difficulty must be progressively harder');
 assert(minute.easy>400&&minute.easy<1000);
 assert(minute.medium>1100&&minute.medium<2400);
 assert(minute.hard>2600&&minute.hard<5200);
 assert.throws(()=>botScoreAt(10,'not-a-difficulty'),/Unknown bot difficulty/);
 assert.throws(()=>botScoreAt(10,'__proto__'),/Unknown bot difficulty/);
});

test('Daniya is a reproducible monotonic score-only opponent on all difficulties',()=>{
 for(const name of BOT_DIFFICULTY_NAMES){
   for(const seed of [0,1,37,123456,0xffffffff]){
     const events=botScoreEventsUntil(90000,name,seed);
     assert(events.length>0);
     let previous=0;
     for(const e of events){
       assert(Number.isInteger(e.at)&&e.at>0);
       assert(Number.isInteger(e.score)&&e.score>previous);
       assert(Number.isInteger(e.delta)&&e.delta>0);
       assert.equal(e.score,previous+e.delta);
       previous=e.score;
     }
     assert.equal(previous,botScoreAt(90000,name,seed));
     assert.deepEqual(events,botScoreEventsUntil(90000,name,seed));
   }
 }
});

test('different rounds have randomized but reproducible opponent scores across all difficulties',()=>{
 for(const name of BOT_DIFFICULTY_NAMES){
  const seeds=[1,2,3,4,5,6,7,8];
  const scores=seeds.map(seed=>botScoreAt(60000,name,seed));
  assert(new Set(scores).size>=4,`${name} must not be the same final score each round`);
  assert.equal(botScoreAt(60000,name,8),scores.at(-1));
  for(const seed of [1,2,3]){
    const events=botScoreEventsUntil(60000,name,seed);
    assert(events.every((e,i)=>i===0?e.at>=1900:e.at-events[i-1].at>=1900));
    assert(events.every((e,i)=>i===0?e.at<=2800:e.at-events[i-1].at<=2800));
    assert.equal(events.at(-1).score,botScoreAt(60000,name,seed));
  }
 }
 assert.throws(()=>botScoreAt(10,'easy',-1),/seed/i);
});
