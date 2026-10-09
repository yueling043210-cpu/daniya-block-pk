// Communication-only bridge observer. Never modifies QQ or affection tables.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const secret=(process.env.BRIDGE_SECRET||fs.readFileSync(path.join(root,'server-data','bridge-secret.txt'),'utf8')).trim();
const api=process.env.API_BASE||'http://127.0.0.1:8787';
const ack=process.argv.includes('--ack');
const headers={Authorization:'Bearer '+secret};
const r=await fetch(api+'/api/bridge/results',{headers});if(!r.ok)throw Error('Failed results HTTP '+r.status);
const data=await r.json();
if(!data.matches.length)console.log('[pk-bridge] no pending results');
for(const m of data.matches){
 console.log(`[pk-bridge] room=${m.roomId} group=${m.groupId} qq=${m.qqId} player=${m.playerScore} bot=${m.botScore} winner=${m.winner} replay=${m.replayChecked} qqVerified=${m.qqIdentityVerified} affection=DISABLED`);
 if(ack){const a=await fetch(api+'/api/bridge/results/'+m.roomId+'/ack',{method:'POST',headers});if(!a.ok)throw Error('Ack failed');console.log(`[pk-bridge] acknowledged ${m.roomId}`);}
}
