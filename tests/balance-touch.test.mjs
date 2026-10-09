import test from 'node:test';
import assert from 'node:assert/strict';
import {BlockGame,botScoreAt,botScoreEventsUntil} from '../docs/engine.js';
import {installTouchControls} from '../docs/touch.js';

test('level uses cumulative cleared rows, updates only after a clear, and correct level multiplier',()=>{
  const g=new BlockGame(55);
  assert.deepEqual([g.score,g.lines,g.level],[0,0,1]);
  // Nine rows previously cleared; one T-piece completes the 10th row.
  g.lines=9;
  g.board[19]=Array(10).fill('J');
  for(const x of [3,4,5])g.board[19][x]='';
  g.current={type:'T',x:3,y:18,cells:[[1,0],[0,1],[1,1],[2,1]]};
  g.lock();
  assert.equal(g.lines,10);
  assert.equal(g.level,2);
  assert.equal(g.score,100,'line is scored with level before the clear');
  // Vertical I piece clears four rows in one lock at level 2.
  g.board=Array.from({length:20},()=>Array(10).fill(''));
  for(let y=16;y<20;y++){g.board[y]=Array(10).fill('S');g.board[y][4]='';}
  g.current={type:'I',x:2,y:16,cells:[[2,0],[2,1],[2,2],[2,3]]};
  g.lock();
  assert.equal(g.lines,14);assert.equal(g.level,2);assert.equal(g.score,1700);
  g.input('down',100);assert(g.score>=1700,'soft drop cannot remove score');
});

test('all difficulty score curves grow gradually every 1.9–2.8s with stable seeded replay',()=>{
  const bands={easy:[490,850,52],medium:[1250,2100,120],hard:[2900,4800,270]};
  for(const [difficulty,[min,max,maxTick]] of Object.entries(bands)){
    for(let seed=1;seed<=500;seed++){
      const events=botScoreEventsUntil(60000,difficulty,seed);
      assert(events.length>=20&&events.length<=32);
      let prevAt=0,prevScore=0;
      for(const event of events){
        assert(event.at-prevAt>=1900&&event.at-prevAt<=2800);
        assert(event.score>prevScore);
        assert.equal(event.score-prevScore,event.delta);
        assert(event.delta<=maxTick,`${difficulty} ${seed} at ${event.at} jumped ${event.delta}`);
        prevAt=event.at;prevScore=event.score;
      }
      const final=botScoreAt(60000,difficulty,seed);
      assert(final>=min&&final<=max,`${difficulty} ${seed} = ${final}`);
      assert.equal(final,botScoreAt(60000,difficulty,seed));
      assert.equal(final,events.at(-1).score);
    }
  }
  assert(botScoreAt(60000,'easy',23)<botScoreAt(60000,'medium',23));
  assert(botScoreAt(60000,'medium',23)<botScoreAt(60000,'hard',23));
  assert.throws(()=>botScoreAt(12000,'__proto__'),/Unknown/);
});

test('board gestures: double tap rotates, swipe shifts cells, hold soft-drops, down flick hard-drops',()=>{
  let n=1000,intervalFn=null,timeoutFn=null;
  const out=[];
  const handlers={};
  const board={clientWidth:300,addEventListener:(name,fn)=>handlers[name]=fn,setPointerCapture(){},removeEventListener(){}};
  const dispose=installTouchControls(board,a=>out.push(a),()=>true,{
    now:()=>n,
    setTimeout:fn=>{timeoutFn=fn;return 1;},clearTimeout:()=>{timeoutFn=null;},
    setInterval:fn=>{intervalFn=fn;return 2;},clearInterval:()=>{intervalFn=null;}
  });
  const fire=(kind,x,y,id=1)=>handlers[kind]({pointerType:'touch',pointerId:id,clientX:x,clientY:y,preventDefault(){}});
  fire('pointerdown',100,100); n+=45;fire('pointerup',100,100);
  n+=180;fire('pointerdown',102,101);n+=30;fire('pointerup',102,101);
  assert.deepEqual(out,['rotate']);
  n+=500;fire('pointerdown',110,100);fire('pointermove',192,100);fire('pointerup',192,100);
  assert.equal(out.filter(x=>x==='right').length,3);
  n+=500;fire('pointerdown',180,100);fire('pointermove',96,100);fire('pointerup',96,100);
  assert.equal(out.filter(x=>x==='left').length,4);
  n+=500;fire('pointerdown',120,100);n+=300;timeoutFn();intervalFn();intervalFn();fire('pointerup',120,100);
  assert.equal(out.filter(x=>x==='down').length,3);
  n+=500;fire('pointerdown',100,30);fire('pointermove',100,140);fire('pointerup',100,140);
  assert.equal(out.at(-1),'drop');
  const len=out.length;fire('pointerdown',100,100);fire('pointercancel',100,100);assert.equal(out.length,len);
  dispose();
});
