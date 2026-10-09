import test from 'node:test';
import assert from 'node:assert/strict';
class MockElement {
 constructor(id=''){
  this.id=id;this.listeners={};this.children=[];this.attrs={};this.dataset={};this.disabled=false;
  this.className='';this.textContent='';this.value='';this.scrollTop=0;this.scrollHeight=42;this.parent=null;
  const names=new Set();this.classList={add:(...c)=>c.forEach(x=>names.add(x)),remove:(...c)=>c.forEach(x=>names.delete(x)),toggle:(s,b)=>{if(b)names.add(s);else names.delete(s)},contains:n=>names.has(n)};
 }
 append(...els){for(const e of els){e.parent=this;this.children.push(e)}}
 replaceChildren(...els){this.children=[...els];for(const e of els)e.parent=this}
 remove(){this.removed=true;if(this.parent)this.parent.children=this.parent.children.filter(c=>c!==this)}
 addEventListener(type,fn){this.listeners[type]=fn}
 setAttribute(name,value){this.attrs[name]=value}
 querySelector(){return this.endPanel}
}
test('dropdown changes only before match; live chat scrolls; final score frozen; restart from centered popup',async()=>{
 const ids=['board','next','notice','start','readyOverlay','playerScore','botScore','lines','level','clock','botRemark','difficultySelect','chatFeed','endOverlay','endHeading','endDetail','endLine','endSync','endReplay','endKicker','left','right','rotate','down','drop'];
 const elements=Object.fromEntries(ids.map(k=>[k,new MockElement(k)]));
 elements.endOverlay.endPanel=new MockElement('end-panel');
 globalThis.document={getElementById:id=>elements[id],createElement:()=>new MockElement()};
 globalThis.location={search:'',hostname:'test.local'};
 globalThis.window={PK_CONFIG:{},listeners:{},addEventListener(type,fn){this.listeners[type]=fn}};
 let virtualNow=0;globalThis.performance={now:()=>virtualNow};
 let nextFrame=null;globalThis.requestAnimationFrame=fn=>{nextFrame=fn};
 await import('../docs/app.js');
 assert.equal(elements.board.children.length,200);assert.equal(elements.next.children.length,16);
 assert.equal(elements.difficultySelect.value,'easy');
 elements.difficultySelect.value='medium';elements.difficultySelect.listeners.change();
 assert.equal(elements.difficultySelect.value,'medium');
 await elements.start.listeners.click();
 assert.equal(elements.start.disabled,true);
 assert.equal(elements.readyOverlay.classList.contains('hidden'),true);
 assert.equal(elements.chatFeed.children.length,1);
 assert.equal(elements.difficultySelect.disabled,true);
 virtualNow=8000;nextFrame();
 assert(elements.chatFeed.children.length>=2,'eight second dialogue');
 assert.equal(elements.chatFeed.scrollTop,elements.chatFeed.scrollHeight,'chat should scroll to latest');
 virtualNow=90000;nextFrame();
 assert.equal(elements.difficultySelect.disabled,true);
 assert(elements.endHeading.textContent.includes('获胜')||elements.endHeading.textContent.includes('平局'));
 assert.equal(elements.endSync.textContent,'');
 assert.equal(elements.endReplay.disabled,false);
 const displayedBot=elements.botScore.textContent,displayedPlayer=elements.playerScore.textContent;
 elements.difficultySelect.value='hard';elements.difficultySelect.listeners.change();
 assert.equal(elements.difficultySelect.value,'medium','ended match must reject change');
 assert.equal(elements.botScore.textContent,displayedBot,'bot final score must be frozen');
 assert.equal(elements.playerScore.textContent,displayedPlayer,'player final score must be frozen');
 assert.equal(elements.difficultySelect.disabled,true);
 await elements.endReplay.listeners.click();
 assert.equal(elements.start.disabled,true);
 assert.equal(elements.difficultySelect.value,'medium','replay retains difficulty');
 assert.equal(elements.endOverlay.classList.contains('hidden'),true);
 assert.equal(elements.chatFeed.children.length,1,'replay gets a clean chat');
});
