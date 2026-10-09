import test from 'node:test';
import assert from 'node:assert/strict';
import {BlockGame,replay,botScoreAt,botScoreEventsUntil,BOT_DIFFICULTIES,BOT_DIFFICULTY_NAMES} from '../docs/engine.js';
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

test('Daniya has three reproducible difficulty presets with 1.5-3s visual updates',()=>{
  assert.deepEqual(BOT_DIFFICULTY_NAMES,['easy','medium','hard']);
  const minute={};
  for(const name of BOT_DIFFICULTY_NAMES){
    const cfg=BOT_DIFFICULTIES[name];
    const events=botScoreEventsUntil(60000,name);
    assert(events.length>=19&&events.length<=40,`${name} checkpoints: ${events.length}`);
    assert.equal(botScoreAt(0,name),0);
    let prior={at:0,score:0,pieces:0,lines:0};
    for(const event of events){
      assert(event.at-prior.at>=1500&&event.at-prior.at<=3000,`${name} visual interval`);
      assert.equal(botScoreAt(event.at-1,name),prior.score,`${name} no changes between visual ticks`);
      assert.equal(botScoreAt(event.at,name),event.score);
      assert(event.delta>=0&&event.pieces>=prior.pieces&&event.lines>=prior.lines);
      assert.equal(event.score-prior.score,event.delta);
      assert.equal(event.clearBonus>=0,true);
      prior=event;
    }
    const last=events.at(-1);
    const pps=last.pieces/60;
    assert(pps>=cfg.minPps-0.1&&pps<=cfg.maxPps+0.1,`${name} pps=${pps}`);
    minute[name]=last.score;
    assert.equal(last.score,botScoreAt(60000,name));
    assert.equal(last.score,botScoreAt(60000,name),'deterministic replay');
  }
  assert(minute.easy>0&&minute.easy<1500);
  assert(minute.medium>minute.easy&&minute.medium<10000);
  assert(minute.hard>minute.medium*10);
  assert.throws(()=>botScoreAt(10,'not-a-difficulty'),/Unknown bot difficulty/);
  assert.throws(()=>botScoreAt(10,'__proto__'),/Unknown bot difficulty/);
  console.log('PASS difficulty 60s scores',minute);
});

test('Daniya simulation matches line and drop scoring semantics at all difficulties',()=>{
  for(const name of BOT_DIFFICULTY_NAMES){
    const events=botScoreEventsUntil(90000,name);
    const totalPieces=events.at(-1).pieces,totalLines=events.at(-1).lines;
    assert(totalPieces>0&&totalLines>=0);
    assert.equal(events.at(-1).score,botScoreAt(90000,name));
    assert(events.every(e=>Number.isInteger(e.delta)&&e.delta>=0));
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
    assert(events.every((e,i)=>i===0?e.at>=1500:e.at-events[i-1].at>=1500));
    assert(events.every((e,i)=>i===0?e.at<=3000:e.at-events[i-1].at<=3000));
    assert.equal(events.at(-1).score,botScoreAt(60000,name,seed));
  }
 }
 assert.throws(()=>botScoreAt(10,'easy',-1),/seed/i);
});
