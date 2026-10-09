// Deterministic, dependency-free falling-block game engine shared by browser and Node.
// Original implementation for this project. 10x20 board; seeded 7-bag; replayable inputs.
export const WIDTH = 10;
export const HEIGHT = 20;
const FORMS = {
  I: [[0,1],[1,1],[2,1],[3,1]],
  O: [[1,0],[2,0],[1,1],[2,1]],
  T: [[1,0],[0,1],[1,1],[2,1]],
  S: [[1,0],[2,0],[0,1],[1,1]],
  Z: [[0,0],[1,0],[1,1],[2,1]],
  J: [[0,0],[0,1],[1,1],[2,1]],
  L: [[2,0],[0,1],[1,1],[2,1]]
};
export const PIECES = Object.keys(FORMS);
export const ACTIONS = ['left','right','rotate','down','drop'];
const ROTATE_KICKS = [0,-1,1,-2,2];
const rand32 = (seed) => () => {
  let t = seed = (seed + 0x6D2B79F5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const cloneCells = (cells) => cells.map(([x,y]) => [x,y]);
const makePiece = (type) => ({type, x:3, y:-1, cells:cloneCells(FORMS[type])});
export class BlockGame {
  constructor(seed=123456789) {
    this.seed=seed>>>0;
    this.board=Array.from({length:HEIGHT},()=>Array(WIDTH).fill(''));
    this.rng=rand32(this.seed);
    this.bag=[];
    this.current=null;
    this.next=null;
    this.score=0;this.lines=0;this.level=1;
    this.elapsedMs=0;this.gravityAccumulator=0;
    this.ended=false;this.pieces=0;
    this.next=this.takeType();
    this.spawn();
  }
  takeType(){
    if(!this.bag.length){
      const b=PIECES.slice();
      for(let i=b.length-1;i>0;i--){const j=Math.floor(this.rng()*(i+1));[b[i],b[j]]=[b[j],b[i]];}
      this.bag=b;
    }
    return this.bag.pop();
  }
  spawn(){
    this.current=makePiece(this.next);
    this.next=this.takeType();
    this.pieces++;
    if(!this.valid(this.current))this.ended=true;
  }
  blocks(piece=this.current){return piece.cells.map(([x,y])=>[x+piece.x,y+piece.y]);}
  valid(piece){
    return this.blocks(piece).every(([x,y])=>x>=0&&x<WIDTH&&y<HEIGHT&&(y<0||!this.board[y][x]));
  }
  shift(dx,dy){
    if(this.ended)return false;
    const p={...this.current,x:this.current.x+dx,y:this.current.y+dy};
    if(this.valid(p)){this.current=p;return true;}
    return false;
  }
  rotate(){
    if(this.ended)return false;
    if(this.current.type==='O')return true;
    const cells=this.current.cells.map(([x,y])=>[3-y,x]);
    for(const dx of ROTATE_KICKS){
      const p={...this.current,x:this.current.x+dx,cells};
      if(this.valid(p)){this.current=p;return true;}
    }
    return false;
  }
  lock(){
    for(const [x,y] of this.blocks()){
      if(y<0){this.ended=true;return;}
      this.board[y][x]=this.current.type;
    }
    let cleared=0;
    for(let y=HEIGHT-1;y>=0;y--){
      if(this.board[y].every(Boolean)){
        this.board.splice(y,1);
        this.board.unshift(Array(WIDTH).fill(''));
        cleared++;y++;
      }
    }
    if(cleared){this.score+=([0,100,300,500,800][cleared]??800)*this.level;this.lines+=cleared;this.level=1+Math.floor(this.lines/10);}
    this.spawn();
  }
  fall(gravity=false){
    if(!this.shift(0,1))this.lock();
    else if(!gravity)this.score+=1;
  }
  interval(){return Math.max(110,690-(this.level-1)*53);}
  advanceTo(ms){
    if(!Number.isFinite(ms)||ms<this.elapsedMs||ms>3600000)throw new Error('Invalid game time');
    let remain=ms-this.elapsedMs;
    while(remain>0){
      const interval=this.interval();
      const next=Math.min(remain,interval-this.gravityAccumulator);
      this.gravityAccumulator+=next;
      remain-=next;
      if(this.gravityAccumulator>=interval-0.000001){
        this.gravityAccumulator=0;
        if(!this.ended)this.fall(true);
      }
    }
    this.elapsedMs=ms;
  }
  input(action,ms){
    if(!ACTIONS.includes(action))throw new Error('Unknown action');
    this.advanceTo(ms);
    if(this.ended)return;
    if(action==='left')this.shift(-1,0);
    if(action==='right')this.shift(1,0);
    if(action==='rotate')this.rotate();
    if(action==='down')this.fall(false);
    if(action==='drop'){
      let distance=0;
      while(this.shift(0,1))distance++;
      this.score+=2*distance;
      this.lock();
    }
  }
  snapshot(){
    return {seed:this.seed,board:this.board.map(row=>row.slice()),active:this.ended?[]:this.blocks(),type:this.current?.type,
      next:this.next,score:this.score,lines:this.lines,level:this.level,ended:this.ended,elapsedMs:this.elapsedMs};
  }
}
// Daniya is an explicitly simulated opponent, NOT an OpenClaw-controlled player.
// PPS represents pieces placed each second, separate from the calm 1.5~3s score
// updates. The 40-line sprint record is a SPEED benchmark, not a score record.
export const BOT_DIFFICULTIES = Object.freeze({
  easy:   Object.freeze({label:'简单', minPps:0.18, maxPps:0.30, seed:0xDA1A0101}),
  medium: Object.freeze({label:'中等', minPps:0.46, maxPps:0.72, seed:0xDA1A0202}),
  hard:   Object.freeze({label:'困难 · 世界级速度模拟', minPps:6.20, maxPps:6.80, seed:0xDA1A0303})
});
export const BOT_DIFFICULTY_NAMES = Object.freeze(Object.keys(BOT_DIFFICULTIES));
const BOT_MAX_MS = 180000; // matches the maximum permitted server room duration
const BOT_SCORES = [0,100,300,500,800]; // same level-1 line-clear table as BlockGame
const cachedBotEvents=new Map();
function buildBotEvents(difficulty,matchSeed=0){
  const cfg=BOT_DIFFICULTIES[difficulty];
  if(!Object.hasOwn(BOT_DIFFICULTIES,difficulty))throw new Error('Unknown bot difficulty');
  // Match seed changes between rounds, but stays identical for the browser and replay server.
  const rand=rand32((cfg.seed ^ (Number(matchSeed)>>>0))>>>0);
  const events=[];
  let at=0,score=0,totalPieces=0,totalLines=0;
  let carry=0,fill=0,waitingLines=0;
  let groupTarget=chooseGroup();
  function chooseGroup(){
    const q=rand();
    if(difficulty==='easy') return q<0.91?1:2;
    if(difficulty==='medium')return q<0.50?1:q<0.85?2:q<0.97?3:4;
    return q<0.12?1:q<0.32?2:q<0.53?3:4;
  }
  while(true){
    // Presentation ticks only; more than one piece can settle in a tick.
    const delay=1500+Math.floor(rand()*1501);
    at+=delay;
    if(at>BOT_MAX_MS)break;
    const pps=cfg.minPps+(cfg.maxPps-cfg.minPps)*rand();
    carry+=pps*delay/1000;
    const settled=Math.floor(carry);carry-=settled;
    let delta=0,clearBonus=0,clearedNow=0;
    for(let i=0;i<settled;i++){
      totalPieces++;
      // Drop points use the player's 2/cell hard-drop + 1/cell soft-drop scale.
      delta+=2*(4+Math.floor(rand()*12))+Math.floor(rand()*3);
      // Approximate productive cell placements; a line needs 10 occupied cells.
      const placement= difficulty==='easy' ? 2.25+0.50*rand()
        : difficulty==='medium' ? 2.95+0.45*rand()
        : 3.55+0.35*rand();
      fill+=placement;
      while(fill>=10){fill-=10;waitingLines++;}
      while(waitingLines>=groupTarget){
        const level=1+Math.floor(totalLines/10);
        const earned=BOT_SCORES[groupTarget]*level;
        delta+=earned;clearBonus+=earned;
        waitingLines-=groupTarget;totalLines+=groupTarget;clearedNow+=groupTarget;
        groupTarget=chooseGroup();
      }
    }
    score+=delta;
    events.push({at,delta,score,clearBonus,settled,pieces:totalPieces,lines:totalLines,clearedNow});
  }
  return events;
}
function eventsFor(difficulty,matchSeed=0){
  if(!Object.hasOwn(BOT_DIFFICULTIES,difficulty))throw new Error('Unknown bot difficulty');
  if(!Number.isInteger(matchSeed)||matchSeed<0||matchSeed>0xffffffff)throw new Error('Invalid bot match seed');
  const key=difficulty+':'+matchSeed;
  if(!cachedBotEvents.has(key)){
    // Bound memory usage on devices opening many practice rounds.
    if(cachedBotEvents.size>=32)cachedBotEvents.delete(cachedBotEvents.keys().next().value);
    cachedBotEvents.set(key,buildBotEvents(difficulty,matchSeed));
  }
  return cachedBotEvents.get(key);
}
export function botScoreEventsUntil(ms,difficulty='easy',matchSeed=0){
  const limit=Math.min(BOT_MAX_MS,Math.max(0,Number.isFinite(ms)?ms:0));
  return eventsFor(difficulty,matchSeed).filter(e=>e.at<=limit);
}
export function botScoreAt(ms,difficulty='easy',matchSeed=0){
  const events=eventsFor(difficulty,matchSeed);
  const limit=Math.min(BOT_MAX_MS,Math.max(0,Number.isFinite(ms)?ms:0));
  let low=0,high=events.length;
  while(low<high){const mid=(low+high)>>>1;if(events[mid].at<=limit)low=mid+1;else high=mid;}
  return low?events[low-1].score:0;
}
// A top-out is always a loss, regardless of the score accumulated so far.
export function resolveWinner(playerScore,botScore,topOut=false){
  if(topOut)return 'bot';
  return playerScore>botScore?'player':playerScore<botScore?'bot':'tie';
}
export function replay(seed,events,elapsedMs){
  if(!Array.isArray(events)||events.length>3000)throw new Error('Invalid actions');
  const game=new BlockGame(seed);
  let prev=-1;
  const perSecond=new Map();let lastDrop=-1000;
  for(const e of events){
    if(!e||!ACTIONS.includes(e.a)||!Number.isInteger(e.t)||e.t<0||e.t<prev||e.t>elapsedMs)throw new Error('Bad action log');
    const second=Math.floor(e.t/1000);
    const n=(perSecond.get(second)||0)+1;
    if(n>40)throw new Error('Too many actions');
    perSecond.set(second,n);
    if(e.a==='drop'){
      if(e.t-lastDrop<70)throw new Error('Implausible drop frequency');
      lastDrop=e.t;
    }
    game.input(e.a,e.t);prev=e.t;
  }
  game.advanceTo(elapsedMs);
  return game.snapshot();
}
