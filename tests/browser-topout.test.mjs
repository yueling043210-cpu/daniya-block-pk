import test from 'node:test';
import assert from 'node:assert/strict';

class MockElement {
 constructor(id=''){
  this.id=id;this.listeners={};this.children=[];this.dataset={};this.disabled=false;this.className='';this.textContent='';this.value='';this.scrollTop=0;this.scrollHeight=100;this.parent=null;
  const names=new Set();this.classList={add:(...v)=>v.forEach(x=>names.add(x)),remove:(...v)=>v.forEach(x=>names.delete(x)),contains:v=>names.has(v)};
 }
 append(...els){for(const x of els){x.parent=this;this.children.push(x)}}
 replaceChildren(...xs){this.children=xs;for(const x of xs)x.parent=this}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this)}
 addEventListener(k,fn){this.listeners[k]=fn}
 querySelector(){return this.endPanel}
}
test('browser immediately declares bot winner on top-out even while player leads',async()=>{
 const names=['board','next','notice','start','readyOverlay','playerScore','botScore','lines','level','clock','botRemark','difficultySelect','chatFeed','endOverlay','endHeading','endDetail','endLine','endSync','endReplay','endKicker','left','right','rotate','down','drop'];
 const els=Object.fromEntries(names.map(id=>[id,new MockElement(id)]));
 els.endOverlay.endPanel=new MockElement('end-panel');
 globalThis.document={getElementById:id=>els[id],createElement:()=>new MockElement()};
 globalThis.window={PK_CONFIG:{},addEventListener:()=>{}};
 globalThis.location={search:'',hostname:'test.local'};
 let now=0;globalThis.performance={now:()=>now};
 globalThis.requestAnimationFrame=()=>{};
 await import('../docs/app.js?browser-topout');
 await els.start.listeners.click();
 let tries=0;
 while(els.endOverlay.classList.contains('hidden')&&tries++<70){
  now+=100;
  els.drop.listeners.pointerdown({preventDefault(){}});
 }
 assert(!els.endOverlay.classList.contains('hidden'),'top-out should end game immediately');
 assert.equal(els.endHeading.textContent,'达妮娅获胜！');
 assert.equal(els.endLine.textContent,'');
 assert(els.chatFeed.children.some(c=>/堆到顶|结束了呀|差一点|有点可惜/.test(c.children?.[1]?.textContent||'')),'top-out commentary should be appended');
 const p=Number(els.playerScore.textContent.replaceAll(',',''));
 const b=Number(els.botScore.textContent.replaceAll(',',''));
 assert(p>b,`repro must show bot wins despite trailing score: ${p}, ${b}`);
 assert.equal(els.difficultySelect.disabled,true);
 assert.equal(els.endReplay.listeners.click,undefined);
});
