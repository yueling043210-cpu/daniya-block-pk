import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {BlockGame,botScoreAt} from '../docs/engine.js';
const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
test('full local communication: create, start, replay score, poll, acknowledge',async()=>{
 const port=29000+Math.floor(Math.random()*15000), secret='test-secret-at-least-32-long-88ff';
 const isolatedDataDir=fs.mkdtempSync(path.join(os.tmpdir(),'daniya-pk-api-test-'));
 const child=spawn(process.execPath,['server/server.mjs'],{cwd:base,env:{...process.env,PORT:String(port),HOST:'127.0.0.1',BRIDGE_SECRET:secret,BLOCK_PK_DATA_DIR:isolatedDataDir},stdio:['ignore','pipe','pipe']});
 let log=''; child.stdout.on('data',b=>log+=b);child.stderr.on('data',b=>log+=b);
 const api=`http://127.0.0.1:${port}`;
 const hit=async(path,options={})=>{const r=await fetch(api+path,options);let data=await r.json();return {status:r.status,data};};
 const auth={Authorization:`Bearer ${secret}`,'Content-Type':'application/json'};
 try{
   let ready=false;
   for(let i=0;i<40;i++){
     try{const r=await hit('/api/health');if(r.data.ok){ready=true;break;}}catch{}
     await new Promise(res=>setTimeout(res,90));
   }
   assert(ready,'server failed to start\n'+log);
   let r=await hit('/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({groupId:'1058380864',qqId:'2820758373'})});
   assert.equal(r.status,401);
   r=await hit('/api/rooms',{method:'POST',headers:auth,body:JSON.stringify({groupId:'1058380864',qqId:'2820758373',playerName:'测试',durationSeconds:5,difficulty:'bad'})});
   assert.equal(r.status,400,'invalid room difficulty rejected');
   r=await hit('/api/rooms',{method:'POST',headers:auth,body:JSON.stringify({groupId:'1058380864',qqId:'2820758373',difficulty:'__proto__'})});
   assert.equal(r.status,400,'prototype-based difficulty must be rejected');
   r=await hit('/api/rooms',{method:'POST',headers:auth,body:JSON.stringify({groupId:'1058380864',qqId:'2820758373',playerName:'测试',durationSeconds:5,difficulty:'medium'})});
   assert.equal(r.status,201);const {id,ticket}=r.data;
   assert(id);assert(ticket);assert(r.data.roomUrl.includes('room='));assert.equal(r.data.difficulty,'medium');
   r=await hit(`/api/rooms/${id}?ticket=${ticket}`);assert.equal(r.data.status,'ready');assert.equal(r.data.difficulty,'medium');
   r=await hit(`/api/rooms/${id}/start`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ticket})});
   assert.equal(r.status,200);assert.equal(r.data.difficulty,'medium');
   const game=new BlockGame(r.data.seed);
   const events=[{a:'left',t:120},{a:'rotate',t:220},{a:'drop',t:450},{a:'right',t:730},{a:'drop',t:1000}];
   for(const x of events)game.input(x.a,x.t);
   game.advanceTo(5000);
   let payload={ticket,score:game.score+30,lines:game.lines,elapsedMs:5000,events};
   r=await hit(`/api/rooms/${id}/finish`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
   assert.equal(r.status,422); // tampered score rejected
   await new Promise(res=>setTimeout(res,5250));
   payload.score=game.score;
   r=await hit(`/api/rooms/${id}/finish`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
   assert.equal(r.status,200,JSON.stringify(r.data));
   assert.equal(r.data.playerScore,game.score);
   assert.equal(r.data.replayChecked,true);
   assert.equal(r.data.botScore,botScoreAt(5000,'medium',game.seed));
   assert.equal(r.data.affectionEligible,false);
   // Second room: top-out before the timer must lose even when player has more points.
   const p=await hit('/api/rooms',{method:'POST',headers:auth,body:JSON.stringify({groupId:'1058380864',qqId:'3154665303',durationSeconds:10,difficulty:'easy'})});
   assert.equal(p.status,201);
   const rid=p.data.id,rticket=p.data.ticket;
   const st=await hit(`/api/rooms/${rid}/start`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ticket:rticket})});
   assert.equal(st.status,200);
   const top=new BlockGame(st.data.seed), topActions=[];let topMs=0;
   while(!top.ended && topMs<7000){topMs+=100;top.input('drop',topMs);topActions.push({a:'drop',t:topMs});}
   assert(top.ended,'top-out should be reached');
   assert(top.score>botScoreAt(topMs,'easy',top.seed),'player must lead at topout');
   const topRes=await hit(`/api/rooms/${rid}/finish`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ticket:rticket,score:top.score,lines:top.lines,elapsedMs:topMs,events:topActions})});
   assert.equal(topRes.status,200,JSON.stringify(topRes.data));
   assert.equal(topRes.data.winner,'bot');
   assert.equal(topRes.data.topOut,true);
   assert.equal(topRes.data.endReason,'topout');
   r=await hit('/api/bridge/results',{headers:auth});
   assert.equal(r.data.matches.length,2);assert(r.data.matches.some(m=>m.qqId==='2820758373'));assert(r.data.matches.some(m=>m.qqId==='3154665303' && m.winner==='bot'));
   r=await hit(`/api/bridge/results/${id}/ack`,{method:'POST',headers:auth});assert.equal(r.status,200);
   r=await hit(`/api/bridge/results/${rid}/ack`,{method:'POST',headers:auth});assert.equal(r.status,200);
   r=await hit('/api/bridge/results',{headers:auth});assert.equal(r.data.matches.length,0);
   r=await hit(`/api/rooms/${id}/start`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ticket})});assert.equal(r.status,409);
   console.log('PASS API roundtrip, tamper rejection, no affection, Bridge pending/ack');
 }finally{child.kill();fs.rmSync(isolatedDataDir,{recursive:true,force:true});}
});
