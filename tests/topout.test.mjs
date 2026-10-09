import test from 'node:test';
import assert from 'node:assert/strict';
import {BlockGame,replay,botScoreAt,resolveWinner} from '../docs/engine.js';
test('top-out always loses even if player score is higher',()=>{
 const seed=0;const game=new BlockGame(seed);const actions=[];
 let t=0;while(!game.ended && t<10000){t+=100;game.input('drop',t);actions.push({a:'drop',t});}
 assert(game.ended,'the straight-down stack must hit the top');
 const bot=botScoreAt(t,'easy',seed);
 assert(game.score>bot,`test must cover player already winning: ${game.score} <= ${bot}`);
 assert.equal(resolveWinner(game.score,bot,true),'bot');
 assert.equal(resolveWinner(game.score,bot,false),'player');
 const verified=replay(seed,actions,t);
 assert(verified.ended);assert.equal(verified.score,game.score);
});
