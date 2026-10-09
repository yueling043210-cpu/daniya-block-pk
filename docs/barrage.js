// Dialogue content is display-only and never affects the replayed PK score.
// They are deliberately original, brief and playful rather than game instructions.
export const BARRAGE = Object.freeze({
  idle: Object.freeze([
    '呵……还没认真起来吗？','慢慢来，我可不催你哦～','那块放右边是不是更好呀？',
    '输了不许装作没看见。','嗯哼，这局还挺有趣。','哎呀，手滑了吗？',
    '想赢我？先稳住手里的方块。','我已经在想胜利台词了。','看好啦，接下来可是重点。',
    '别眨眼，分数会偷偷长大的。','嘿嘿，你看起来有点紧张。','哼，我才没有故意放水。',
    '让我看看你的真本事～','这么认真，我也得打起精神了。','等等，这块形状很眼熟……',
    '别只顾着看我的分数呀。','来嘛，和我比到底！','要是输了，就当陪我玩啦。',
    '嗯？你不会要放弃了吧？','我喜欢这样的挑战。','不要急，稳一点才厉害。',
    '这局结束再吹牛也不迟。','啧啧，差一点就连上了。','让我猜猜你的下一步。',
    '心急可是方块游戏的大敌哦。','这招不错，有一点点厉害。','我可一直在看着呢。',
    '加油呀，不许太早认输～'
  ]),
  playerLead: Object.freeze([
    '诶？你竟然领先了……','别得意，我还会追上来的！',
    '好嘛，这分数还真有点吓人。','难得见你这么会玩。','赢我还早着呢，哼。'
  ]),
  botLead: Object.freeze([
    '我的分数已经跑到前面啦～','要不要我稍微放慢一点呀？',
    '哎呀，你落后了呢。','哼哼，追得上我再说！','现在认输还来得及哦？'
  ]),
  playerOvertake: Object.freeze([
    '等等！你怎么突然反超我了？','诶——刚才不是我领先吗！',
    '好快……我得认真一点了。','居然被你超过了，讨厌啦！',
    '可恶，这波操作还真漂亮。'
  ]),
  botOvertake: Object.freeze([
    '抓到你啦！我反超了～','哼哼，我的反击开始了。',
    '看到了吗？这才叫追分！','不要松懈，我已经超过你了。',
    '嘿嘿，现在轮到你追我啦。'
  ]),
  tie: Object.freeze(['咦，我们的分数居然一样？','平手呀，谁会先打破僵局呢？','这么巧，分数碰到一起啦。'])
});

export const BARRAGE_INTERVAL_MS = 8000;
export const BARRAGE_TOTAL = Object.values(BARRAGE).reduce((n,lines)=>n+lines.length,0);
export function leadState(playerScore,botScore){
  if(playerScore>botScore)return 'player';
  if(playerScore<botScore)return 'bot';
  return 'tie';
}
export function leadReaction(before,after){
  if(before===after)return null;
  if(before==='bot'&&after==='player')return 'playerOvertake';
  if(before==='player'&&after==='bot')return 'botOvertake';
  if(after==='player')return 'playerLead';
  if(after==='bot')return 'botLead';
  return 'tie';
}
export function selectBarrage(kind='idle', rng=Math.random, excluded=[]){
  const pool=BARRAGE[kind]||BARRAGE.idle;
  const alternatives=pool.filter(line=>!excluded.includes(line));
  const eligible=alternatives.length?alternatives:pool;
  const raw=Number(rng());
  const index=Math.min(eligible.length-1,Math.max(0,Math.floor((Number.isFinite(raw)?raw:0)*eligible.length)));
  return eligible[index];
}
