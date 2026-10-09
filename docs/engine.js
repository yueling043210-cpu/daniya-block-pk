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
export function botScoreAt(ms){
  const s=Math.max(0,ms)/1000;
  return Math.floor(36*s + Math.floor(s/17)*125 + 60*Math.sin(s/13)**2);
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
