// Daniya Block PK v0.2.5: approved 69-line personality dialogue.
// Dialogue is display-only; game score, replay, room identity, and server validation remain independent.
export const BARRAGE = Object.freeze({
  idle: Object.freeze([
    "诶——别着急呀",
    "笨蛋，别盯着我看呀，方块都要落下来了",
    "唔……让我想想下一块放在哪里",
    "你这么认真，弄得我都有点不好意思偷懒了",
    "哈……偶尔动动脑子，也不是不行啦",
    "要是赢了能换甜品就好了……诶，你会请客吗？",
    "你是不是在偷偷观察我的操作？真狡猾呀",
    "不要急啦，越着急越容易出错哦",
    "明明只是堆方块，却意外地让人停不下来呢",
    "说起来，我小时候就很擅长这个游戏哦",
    "你该不会一直在等我失误吧？好坏呀",
    "有时候，犯点小错误也没什么不好嘛",
    "啧，这块怎么偏偏在这种时候出现……",
    "你玩得还挺开心的嘛……",
    "唔……总觉得下一块会很麻烦呢",
    "诶？你刚才是不是犹豫了一下？",
    "这种时候，要是能喝杯热乎乎的奶茶就好了",
    "哼哼，别以为我很好欺负哦",
    "方块落下去就不能后悔了哦~",
    "这是……在打什么坏主意吗？",
    "啊……刚才那个位置，我好像有更好的放法",
    "太认真会累的啦，偶尔放松一下嘛",
    "诶——要是方块都能乖乖听话就好了",
    "结束之后……我们去哪玩呢？算啦，先玩好这一局吧",
    "那块放右边是不是更好呀？",
    "别只顾着看我的分数呀",
    "啧啧，差一点就连上了",
    "让我猜猜你的下一步",
    "让我看看你的真本事～",
    "哼，我才没有故意放水"
  ]),
  playerLead: Object.freeze([
    "诶？你竟然领先了……",
    "别得意太早哦，我还没开始认真呢",
    "看来得稍微认真一点了……麻烦死了",
    "这点分差就想让我认输？嗯哼，想得美",
    "你今天手感不错嘛……就先让你高兴一会儿好了",
    "想赢我还早着呢"
  ]),
  botLead: Object.freeze([
    "空气怎么突然这么安静啦？",
    "别着急嘛，说不定很快就能追上我了哦",
    "嘿嘿，怎么样？是不是有点小看我啦",
    "现在认输的话，可就看不到后面的好戏了呀",
    "嗯？你不会要放弃了吧？",
    "要不要我稍微放慢一点呀？",
    "哎呀，你落后了呢",
    "现在认输还来得及哦？"
  ]),
  playerOvertake: Object.freeze([
    "诶？什么时候超过我的……",
    "刚才明明还在后面……真是狡猾呢",
    "啧，被反超了啊……看来不能再偷懒了",
    "做得不错嘛……不过别指望我夸第二遍哦",
    "唔……居然真的超过我了，有点不甘心呢",
    "……得认真一点了",
    "居然被反超了，讨厌啦！"
  ]),
  botOvertake: Object.freeze([
    "哼哼，位置换过来了呢",
    "诶——别露出那种表情嘛，我只是超过了一点点",
    "刚才不是还挺得意的吗？怎么啦？",
    "这下轮到你追我了哦，可别掉队呀",
    "我说过会追上来的嘛……",
    "嘿嘿，现在轮到你追我啦"
  ]),
  tie: Object.freeze([
    "诶，居然一样分？真巧呀",
    "谁会先打破这个平局呢……有点期待",
    "谁也没赢，谁也没输……这样倒也不错嘛"
  ]),
  topout: Object.freeze([
    "哎呀，堆到顶了……刚才是不是太着急啦",
    "结束了呀……别露出那副表情嘛",
    "唔，差一点就能撑住了呢……下次再试试？",
    "我可没笑你哦……只是觉得刚才那块有点可惜"
  ]),
  playerWin: Object.freeze([
    "唔……居然让你赢了，真讨厌",
    "好吧好吧，是你赢啦……这次算你厉害",
    "偶尔犯点小错误，才能显得更好接近哦"
  ]),
  botWin: Object.freeze([
    "嘿嘿，看来这次是我赢啦",
    "诶，结束了？那胜利就归我咯"
  ]),
});

export const BARRAGE_INTERVAL_MS = 8000;
export const BARRAGE_TOTAL = Object.values(BARRAGE).reduce((n, lines) => n + lines.length, 0);
export function leadState(playerScore, botScore) {
  if (playerScore > botScore) return 'player';
  if (playerScore < botScore) return 'bot';
  return 'tie';
}
export function leadReaction(before, after) {
  if (before === after) return null;
  if (before === 'bot' && after === 'player') return 'playerOvertake';
  if (before === 'player' && after === 'bot') return 'botOvertake';
  if (after === 'player') return 'playerLead';
  if (after === 'bot') return 'botLead';
  return 'tie';
}
// Preserve the last decisive leader across a short tie, so bot→tie→player is a real overtake.
export function leadEvent(previous, next, lastDecisive = previous) {
  if (previous === next) return null;
  if (next === 'tie') return 'tie';
  if (lastDecisive === 'bot' && next === 'player') return 'playerOvertake';
  if (lastDecisive === 'player' && next === 'bot') return 'botOvertake';
  return next === 'player' ? 'playerLead' : 'botLead';
}
export function selectBarrage(kind = 'idle', rng = Math.random, excluded = []) {
  const pool = BARRAGE[kind] || BARRAGE.idle;
  const available = pool.filter(line => !excluded.includes(line));
  const eligible = available.length ? available : pool;
  const raw = Number(rng());
  const index = Math.min(eligible.length - 1, Math.max(0, Math.floor((Number.isFinite(raw) ? raw : 0) * eligible.length)));
  return eligible[index];
}
