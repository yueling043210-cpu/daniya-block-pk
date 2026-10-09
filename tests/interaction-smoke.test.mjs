import test from 'node:test';
import assert from 'node:assert/strict';

// Minimal DOM event smoke test for module wiring. Layout pixels still require real QQ validation.
class MockElement {
 constructor(id=''){
  this.id=id;this.listeners={};this.children=[];this.attrs={};this.dataset={};this.disabled=false;
  this.className='';this.textContent='';this.style={setProperty(){}};
  const names=new Set();this.classList={add:(...c)=>c.forEach(x=>names.add(x)),remove:(...c)=>c.forEach(x=>names.delete(x)),toggle:(s,b)=>{if(b)names.add(s);else names.delete(s)},contains:n=>names.has(n)};
 }
 append(...els){this.children.push(...els)}
 replaceChildren(...els){this.children=els}
 remove(){this.removed=true}
 addEventListener(type,fn){this.listeners[type]=fn}
 setAttribute(name,value){this.attrs[name]=value}
 querySelector(){return this.endPanel}
 querySelectorAll(){return this.options||[]}
}
test('browser module handles difficulty, match start, periodic dialogue and end overlay',async()=>{
 const ids=['board','next','notice','start','restart','gameStatus','playerScore','botScore','lines','level','clock','botRemark','difficultyList','danmakuLayer','barrageAccessible','endOverlay','endHeading','endDetail','endLine','endSync','endReplay','endKicker','left','right','rotate','down','drop'];
 const elements=Object.fromEntries(ids.map(k=>[k,new MockElement(k)]));
 const options=['easy','medium','hard'].map(level=>{const e=new MockElement(level);e.dataset.difficulty=level;return e;});
 elements.difficultyList.options=options;
 elements.endOverlay.endPanel=new MockElement('end-panel');
 globalThis.document={getElementById:id=>elements[id],createElement:()=>new MockElement()};
 globalThis.location={search:'',hostname:'test.local'};
 globalThis.window={PK_CONFIG:{},listeners:{},addEventListener(type,fn){this.listeners[type]=fn}};
 globalThis.performance={now:()=>virtualNow};
 let virtualNow=0;let nextFrame=null;
 globalThis.requestAnimationFrame=fn=>{nextFrame=fn};
 await import('../docs/app.js');
 assert.equal(elements.board.children.length,200);
 assert.equal(elements.next.children.length,16);
 assert.equal(options[0].attrs['aria-expanded'],'true');
 options[1].listeners.click();
 assert.equal(options[1].attrs['aria-expanded'],'true');
 assert.equal(options[0].attrs['aria-expanded'],'false');
 await elements.start.listeners.click();
 assert.equal(elements.gameStatus.textContent,'PLAYING');
 assert.equal(elements.danmakuLayer.children.length,1); // opening taunt
 assert.equal(options[1].disabled,true);
 virtualNow=8000;nextFrame();
 assert(elements.danmakuLayer.children.length>=2); // 8-second random line
 virtualNow=90000;nextFrame();
 assert.equal(elements.gameStatus.textContent,'FINISHED');
 assert(elements.endHeading.textContent.includes('获胜')||elements.endHeading.textContent.includes('平局'));
 assert(elements.endSync.textContent.includes('本地体验'));
 assert.equal(elements.endReplay.disabled,false);
 await elements.endReplay.listeners.click();
 assert.equal(elements.gameStatus.textContent,'PLAYING');
});
