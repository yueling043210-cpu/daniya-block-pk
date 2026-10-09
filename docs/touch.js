// Pointer gestures use the exact same five replayable actions as keyboard buttons.
// A phone's ordinary tap is inert to avoid accidental unlogged moves.
export function installTouchControls(board, act, canPlay=()=>true, options={}){
  const now=options.now||(()=>Date.now());
  const later=options.setTimeout||setTimeout;
  const cancel=options.clearTimeout||clearTimeout;
  const every=options.setInterval||setInterval;
  const stopEvery=options.clearInterval||clearInterval;
  let pointer=null,holdTimer=null,repeatTimer=null,lastTap=null;
  function stopTimers(){
    if(holdTimer!==null){cancel(holdTimer);holdTimer=null;}
    if(repeatTimer!==null){stopEvery(repeatTimer);repeatTimer=null;}
  }
  const emit=action=>{if(canPlay())act(action);};
  function cellWidth(){return Math.max(17,(board.clientWidth||270)/10*0.70);}
  function down(e){
    if(!['touch','pen'].includes(e.pointerType)||!canPlay()||pointer)return;
    e.preventDefault();
    pointer={id:e.pointerId,x:e.clientX,y:e.clientY,started:now(),steps:0,swiped:false,held:false};
    board.setPointerCapture?.(e.pointerId);
    stopTimers();
    holdTimer=later(()=>{
      if(!pointer||!canPlay()||pointer.swiped)return;
      pointer.held=true;
      emit('down');
      repeatTimer=every(()=>{if(pointer&&canPlay())emit('down');else stopTimers();},85);
    },300);
  }
  function move(e){
    if(!pointer||pointer.id!==e.pointerId)return;
    e.preventDefault();
    const dx=e.clientX-pointer.x,dy=e.clientY-pointer.y;
    if(Math.abs(dy)>24||Math.abs(dx)>12){
      pointer.swiped=true;stopTimers();lastTap=null;
    }
    if(Math.abs(dx)>=Math.abs(dy)*0.8){
      const steps=Math.trunc(dx/cellWidth());
      while(pointer.steps<steps){emit('right');pointer.steps++;}
      while(pointer.steps>steps){emit('left');pointer.steps--;}
    }
  }
  function finish(e){
    if(!pointer||pointer.id!==e.pointerId)return;
    e.preventDefault();stopTimers();
    const dx=e.clientX-pointer.x,dy=e.clientY-pointer.y;
    const duration=now()-pointer.started;
    const wasHeld=pointer.held;
    const isTap=!wasHeld&&duration<290&&Math.abs(dx)<20&&Math.abs(dy)<20;
    if(!wasHeld&&dy>55&&dy>Math.abs(dx)*1.3){emit('drop');lastTap=null;}
    else if(isTap){
      if(lastTap&&now()-lastTap.time<=330&&Math.hypot(e.clientX-lastTap.x,e.clientY-lastTap.y)<=70){
        emit('rotate');lastTap=null;
      }else lastTap={time:now(),x:e.clientX,y:e.clientY};
    }else lastTap=null;
    pointer=null;
  }
  function abort(e){if(pointer&&pointer.id===e.pointerId){stopTimers();pointer=null;lastTap=null;}}
  board.addEventListener('pointerdown',down);
  board.addEventListener('pointermove',move);
  board.addEventListener('pointerup',finish);
  board.addEventListener('pointercancel',abort);
  return ()=>{stopTimers();pointer=null;lastTap=null;
    for(const [type,fn] of [['pointerdown',down],['pointermove',move],['pointerup',finish],['pointercancel',abort]])board.removeEventListener?.(type,fn);
  };
}
