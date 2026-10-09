// Touch actions stay in the same replayable action stream as keyboard inputs.
// A long press is a soft drop, a fast downward flick is one hard drop.
// A slower downward drag makes soft-drop steps; horizontal drags move cells.
export function installTouchControls(board, act, canPlay=()=>true, options={}){
  const now=options.now||(()=>Date.now());
  const later=options.setTimeout||setTimeout;
  const cancel=options.clearTimeout||clearTimeout;
  const every=options.setInterval||setInterval;
  const stopEvery=options.clearInterval||clearInterval;
  let pointer=null,holdTimer=null,repeatTimer=null,lastTap=null;
  const emit=action=>{if(canPlay())act(action);};
  const cellWidth=()=>Math.max(17,(board.clientWidth||270)/10*0.7);
  const dropStep=()=>Math.max(16,(board.clientHeight||510)/20*0.9);
  function stopTimers(){
    if(holdTimer!==null){cancel(holdTimer);holdTimer=null;}
    if(repeatTimer!==null){stopEvery(repeatTimer);repeatTimer=null;}
  }
  function down(e){
    if(!['touch','pen'].includes(e.pointerType)||!canPlay()||pointer)return;
    e.preventDefault();
    pointer={id:e.pointerId,x:e.clientX,y:e.clientY,started:now(),axis:null,xSteps:0,ySteps:0,held:false};
    lastTap=lastTap&&now()-lastTap.time<=330?lastTap:null;
    board.setPointerCapture?.(e.pointerId);
    stopTimers();
    holdTimer=later(()=>{
      if(!pointer||pointer.axis||!canPlay())return;
      pointer.held=true;
      emit('down');
      repeatTimer=every(()=>{if(pointer&&canPlay())emit('down');else stopTimers();},85);
    },320);
  }
  function softSteps(count){
    while(pointer&&pointer.ySteps<count){emit('down');pointer.ySteps++;}
  }
  function move(e){
    if(!pointer||pointer.id!==e.pointerId)return;
    e.preventDefault();
    const dx=e.clientX-pointer.x,dy=e.clientY-pointer.y;
    if(!pointer.axis&&!pointer.held){
      if(Math.abs(dx)>=13&&Math.abs(dx)>Math.abs(dy)*1.1)pointer.axis='horizontal';
      else if(dy>=17&&dy>Math.abs(dx)*1.1)pointer.axis='vertical';
      if(pointer.axis){stopTimers();lastTap=null;}
    }
    if(pointer.axis==='horizontal'){
      const steps=Math.trunc(dx/cellWidth());
      while(pointer.xSteps<steps){emit('right');pointer.xSteps++;}
      while(pointer.xSteps>steps){emit('left');pointer.xSteps--;}
    }else if(pointer.axis==='vertical'){
      // Withhold early movement until a quick flick can be distinguished.
      if(now()-pointer.started>=180)softSteps(Math.min(20,Math.floor(dy/dropStep())));
    }
  }
  function finish(e){
    if(!pointer||pointer.id!==e.pointerId)return;
    e.preventDefault();stopTimers();
    const dx=e.clientX-pointer.x,dy=e.clientY-pointer.y;
    const duration=Math.max(1,now()-pointer.started);
    const wasHeld=pointer.held;
    const fastFlick=!wasHeld&&dy>=68&&dy>Math.abs(dx)*1.3&&duration<=330&&dy/duration>=0.42;
    const isTap=!wasHeld&&!pointer.axis&&duration<300&&Math.abs(dx)<20&&Math.abs(dy)<20;
    if(fastFlick){
      // If we already soft-dropped during a long drag, do not hard-drop as well.
      if(pointer.ySteps===0)emit('drop');
      lastTap=null;
    }else if(!wasHeld&&dy>16&&dy>Math.abs(dx)*1.1){
      softSteps(Math.min(20,Math.floor(dy/dropStep())));
      lastTap=null;
    }else if(isTap){
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
