import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const authSecret='room-test-secret-0123456789abcdef';
let portSeed=37100;
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function launch(dataDir){
 const port=portSeed++;
 const child=spawn(process.execPath,['server/server.mjs'],{cwd:root,env:{...process.env,PORT:String(port),HOST:'127.0.0.1',BRIDGE_SECRET:authSecret,BLOCK_PK_DATA_DIR:dataDir},stdio:['ignore','pipe','pipe']});
 const base=`http://127.0.0.1:${port}`;
 let stderr='';child.stderr.on('data',x=>stderr+=x);
 const req=async(route,body,bridge=false)=>{
  const options=body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json',...(bridge?{Authorization:'Bearer '+authSecret}:{})},body:JSON.stringify(body)};
  const r=await fetch(base+route,options);return {status:r.status,body:await r.json()};
 };
 let ok=false;for(let i=0;i<45;i++){
  try{if((await req('/api/health')).body.ok){ok=true;break;}}catch{} await wait(90);
 }
 if(!ok){child.kill();throw Error('Server startup failed '+stderr);}
 return {child,req};
}
const newRoom=(req)=>req('/api/rooms',{groupId:'1058380864',qqId:'2820758373',durationSeconds:5},true);
test('a second real browser visit invalidates the room; preview GET does not claim',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'block-pk-visits-'));const {child,req}=await launch(dir);
 try{
  const {status,body}=await newRoom(req);assert.equal(status,201);
  assert(body.expiresAt>Date.now()+20000&&body.expiresAt<Date.now()+33000);
  const {id,ticket}=body,c1='a'.repeat(48),c2='b'.repeat(48);
  const preview=await req(`/api/rooms/${id}?ticket=${ticket}`);assert.equal(preview.status,200); // no client marker
  assert.equal((await req(`/api/rooms/${id}?ticket=${ticket}&clientId=${c1}`)).status,200);
  const second=await req(`/api/rooms/${id}?ticket=${ticket}&clientId=${c2}`);
  assert.equal(second.status,409);
  assert.equal((await req(`/api/rooms/${id}?ticket=${ticket}`)).body.status,'invalid');
  assert.equal((await req(`/api/rooms/${id}/start`,{ticket,clientId:c1})).status,409);
  assert.deepEqual((await req('/api/bridge/results')).body,{error:'Bridge authentication required'});
 }finally{child.kill();fs.rmSync(dir,{force:true,recursive:true});}
});
test('30-second invite deadline invalidates unused room after persisted expiration',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'block-pk-expiry-'));
 let srv=await launch(dir);
 try{
  const created=await newRoom(srv.req);assert.equal(created.status,201);
  const {id,ticket}=created.body;
  srv.child.kill();await new Promise(resolve=>srv.child.once('exit',resolve));
  const dbFile=path.join(dir,'matches.json'),db=JSON.parse(fs.readFileSync(dbFile,'utf8'));
  db.rooms[id].expiresAt=Date.now()-1;
  fs.writeFileSync(dbFile,JSON.stringify(db));
  srv=await launch(dir);
  assert.equal((await srv.req(`/api/rooms/${id}?ticket=${ticket}&clientId=${'a'.repeat(48)}`)).status,410);
  assert.equal((await srv.req(`/api/rooms/${id}/start`,{ticket,clientId:'a'.repeat(48)})).status,410);
 }finally{srv.child.kill();fs.rmSync(dir,{force:true,recursive:true});}
});
