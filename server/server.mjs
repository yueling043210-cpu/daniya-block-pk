// Daniya Block PK local test API - Node.js 22+, no third-party dependencies.
// Bind localhost by default; for public use place behind TLS reverse proxy and auth.
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {replay,botScoreAt,BOT_DIFFICULTIES} from '../docs/engine.js';
const selfDir=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(selfDir,'..');
const docs=path.resolve(root,'docs');
const dataDir=path.resolve(root,'server-data');
const dbFile=path.join(dataDir,'matches.json');
const secretFile=path.join(dataDir,'bridge-secret.txt');
fs.mkdirSync(dataDir,{recursive:true});
if(!fs.existsSync(secretFile))fs.writeFileSync(secretFile,crypto.randomBytes(32).toString('hex')+'\n',{mode:0o600,flag:'wx'});
const secret=process.env.BRIDGE_SECRET||fs.readFileSync(secretFile,'utf8').trim();
if(secret.length<28)throw new Error('BRIDGE_SECRET must be at least 28 characters');
const port=Number(process.env.PORT||8787);
const host=process.env.HOST||'127.0.0.1';
const publicGame=process.env.PUBLIC_GAME_URL||`http://127.0.0.1:${port}/`;
const publicApi=process.env.PUBLIC_API_URL||`http://127.0.0.1:${port}`;
const origins=new Set([`http://localhost:${port}`,`http://127.0.0.1:${port}`]);
try{origins.add(new URL(publicGame).origin);}catch{}
for(const o of (process.env.WEB_ORIGIN||'').split(',').map(x=>x.trim()).filter(Boolean))origins.add(o);
let state={rooms:{}};
if(fs.existsSync(dbFile)){
  try{state=JSON.parse(fs.readFileSync(dbFile,'utf8'));if(!state?.rooms||typeof state.rooms!=='object')throw Error('rooms');}
  catch(e){throw Error(`Corrupt server-data/matches.json. Refusing to overwrite: ${e.message}`);}
}
function save(){const tmp=dbFile+'.tmp';fs.writeFileSync(tmp,JSON.stringify(state,null,2));fs.renameSync(tmp,dbFile);}
const sha=x=>crypto.createHash('sha256').update(String(x)).digest('hex');
const makeId=(n)=>crypto.randomBytes(n).toString('base64url');
const json=(res,status,value,extra={})=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...extra});res.end(JSON.stringify(value));};
function bad(res,status,error){return json(res,status,{error});}
function authorized(req){const h=String(req.headers.authorization||'');const received=h.startsWith('Bearer ')?h.slice(7):'';
  if(received.length!==secret.length)return false;
  return crypto.timingSafeEqual(Buffer.from(received),Buffer.from(secret));
}
async function readJson(req){
  const chunks=[];let n=0;
  for await(const part of req){n+=part.length;if(n>250000)throw Error('Payload too large');chunks.push(part);}
  if(!n)return {};
  const parsed=JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if(!parsed||Array.isArray(parsed)||typeof parsed!=='object')throw Error('Expected JSON object');
  return parsed;
}
function accessibleRoom(id,ticket){
  const room=state.rooms[id];if(!room||typeof ticket!=='string')return null;
  const want=Buffer.from(room.ticketHash,'hex'),got=Buffer.from(sha(ticket),'hex');
  return want.length===got.length&&crypto.timingSafeEqual(want,got)?room:null;
}
function expired(room){return !room.startedAt&&Date.now()>room.expiresAt;}
function roomPublic(room){return {id:room.id,playerName:room.playerName,status:expired(room)?'expired':room.status,durationMs:room.durationMs,difficulty:room.difficulty||'easy',createdAt:room.createdAt};}
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.ico':'image/x-icon'};
function serveStatic(req,res,url){
  let pathname;
  try{pathname=decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname);}catch{return bad(res,400,'Bad URL');}
  const file=path.resolve(docs,'.'+pathname);
  if(file!==docs&&!file.startsWith(docs+path.sep))return bad(res,403,'Forbidden');
  if(path.basename(file).startsWith('.')&&!['.nojekyll'].includes(path.basename(file)))return bad(res,404,'Not found');
  let stat;try{stat=fs.statSync(file);}catch{return bad(res,404,'Not found');}
  if(!stat.isFile())return bad(res,404,'Not found');
  res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream', 'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});
  fs.createReadStream(file).pipe(res);
}
const server=http.createServer(async(req,res)=>{
  const origin=req.headers.origin;
  if(origin){if(!origins.has(origin))return bad(res,403,'Origin not allowed');
    res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');
    res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
  }
  if(req.method==='OPTIONS'){res.writeHead(204);return res.end();}
  let u;try{u=new URL(req.url,`http://${req.headers.host||'localhost'}`);}catch{return bad(res,400,'Bad URL');}
  const pathname=u.pathname;
  try{
    if(pathname==='/api/health'&&req.method==='GET')return json(res,200,{ok:true,service:'daniya-block-pk',version:'0.1.3',resultsPending:Object.values(state.rooms).filter(r=>r.status==='finished'&&!r.ackAt).length});
    if(pathname==='/api/rooms'&&req.method==='POST'){
      if(!authorized(req))return bad(res,401,'Bridge authentication required');
      const b=await readJson(req);
      const groupId=String(b.groupId||'').trim(),qqId=String(b.qqId||'').trim();
      if(!/^\d{5,20}$/.test(groupId)||!/^\d{5,20}$/.test(qqId))return bad(res,400,'Need numeric groupId and qqId');
      const durationSeconds=Number(b.durationSeconds??90);
      if(!Number.isInteger(durationSeconds)||durationSeconds<5||durationSeconds>180)return bad(res,400,'Duration must be 5..180 seconds');
      const name=String(b.playerName||'QQ玩家').slice(0,30);
      const difficulty=String(b.difficulty??'easy');
      if(!Object.hasOwn(BOT_DIFFICULTIES,difficulty))return bad(res,400,'Unknown difficulty (easy/medium/hard)');
      const id=makeId(9),ticket=makeId(32);
      const room={id,groupId,qqId,playerName:name,seed:crypto.randomBytes(4).readUInt32LE(0),ticketHash:sha(ticket),createdAt:Date.now(),expiresAt:Date.now()+30*60000,durationMs:durationSeconds*1000,difficulty,status:'ready',startedAt:null,finishedAt:null,result:null,ackAt:null};
      state.rooms[id]=room;save();
      const link=new URL(publicGame);link.searchParams.set('room',id);link.searchParams.set('ticket',ticket);
      console.log(`[pk-room] created room=${id} group=${groupId} qq=${qqId} difficulty=${difficulty}`);
      return json(res,201,{id,roomUrl:link.toString(),ticket,publicApi,durationMs:room.durationMs,difficulty});
    }
    const roomMatch=pathname.match(/^\/api\/rooms\/([a-zA-Z0-9_-]{8,32})(?:\/(start|finish))?$/);
    if(roomMatch){
      const id=roomMatch[1],action=roomMatch[2];
      const b=req.method==='POST'?await readJson(req):{};
      const ticket=req.method==='POST'?b.ticket:u.searchParams.get('ticket');
      const room=accessibleRoom(id,ticket);
      if(!room)return bad(res,404,'Room not found or invalid ticket');
      if(expired(room))return bad(res,410,'Room expired');
      if(!action&&req.method==='GET')return json(res,200,roomPublic(room));
      if(action==='start'&&req.method==='POST'){
        if(room.status!=='ready')return bad(res,409,'Room already started or finished');
        room.status='playing';room.startedAt=Date.now();save();
        console.log(`[pk-room] started room=${id}`);
        return json(res,200,{id,seed:room.seed,durationMs:room.durationMs,difficulty:room.difficulty||'easy'});
      }
      if(action==='finish'&&req.method==='POST'){
        if(room.status!=='playing')return bad(res,409,'Room not in progress');
        const {score,lines,elapsedMs,events}=b;
        if(!Number.isInteger(elapsedMs)||elapsedMs<0||elapsedMs>room.durationMs||!Number.isInteger(score)||score<0||!Number.isInteger(lines)||lines<0)return bad(res,422,'Invalid submitted score');
        // Time-of-day check. Prevent a client instantly claiming an elapsed 90-second game.
        const serverElapsed=Date.now()-room.startedAt;
        if(elapsedMs>serverElapsed+2800)return bad(res,422,'Client clock ahead of server');
        if(serverElapsed>room.durationMs+10*60000)return bad(res,410,'Match reporting timeout');
        let reconstructed;
        try{reconstructed=replay(room.seed,events,elapsedMs);}catch(e){return bad(res,422,'Cannot replay actions: '+e.message);}
        if(reconstructed.score!==score||reconstructed.lines!==lines)return bad(res,422,'Score mismatch with action replay');
        if(!reconstructed.ended&&elapsedMs<room.durationMs-700)return bad(res,422,'Match not completed');
        const botScore=botScoreAt(elapsedMs,room.difficulty||'easy');
        const winner=score>botScore?'player':score<botScore?'bot':'tie';
        room.result={playerScore:score,lines,botScore,winner,elapsedMs,actionCount:events.length,replayChecked:true,
          qqIdentityVerified:false,affectionEligible:false};
        room.finishedAt=Date.now();room.status='finished';save();
        console.log(`[pk-result] room=${id} group=${room.groupId} qq=${room.qqId} score=${score} bot=${botScore} replay=ok`);
        return json(res,200,room.result);
      }
      return bad(res,405,'Method not allowed');
    }
    if(pathname==='/api/bridge/results'&&req.method==='GET'){
      if(!authorized(req))return bad(res,401,'Bridge authentication required');
      const matches=Object.values(state.rooms).filter(r=>r.status==='finished'&&!r.ackAt).map(r=>({roomId:r.id,groupId:r.groupId,qqId:r.qqId,playerName:r.playerName,startedAt:r.startedAt,finishedAt:r.finishedAt,...r.result}));
      return json(res,200,{matches});
    }
    const ackMatch=pathname.match(/^\/api\/bridge\/results\/([a-zA-Z0-9_-]{8,32})\/ack$/);
    if(ackMatch&&req.method==='POST'){
      if(!authorized(req))return bad(res,401,'Bridge authentication required');
      const r=state.rooms[ackMatch[1]];
      if(!r||r.status!=='finished')return bad(res,404,'Result not found');
      r.ackAt=Date.now();save();return json(res,200,{ok:true});
    }
    if(pathname.startsWith('/api/'))return bad(res,404,'API not found');
    if(req.method==='GET'||req.method==='HEAD')return serveStatic(req,res,u);
    return bad(res,405,'Method not allowed');
  }catch(e){
    console.error('[pk-error]',e);
    return bad(res,400,e.message||'Bad request');
  }
});
server.listen(port,host,()=>{
  console.log(`[pk-server] listening http://${host}:${port}`);
  console.log(`[pk-server] local Bridge secret stored at ${secretFile}`);
  if(host!=='127.0.0.1'&&host!=='localhost')console.warn('[SECURITY] PUBLIC HOST: configure HTTPS reverse proxy and restricted incoming traffic. Never expose secret in frontend.');
});
