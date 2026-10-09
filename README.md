# 达妮娅 · 方块 PK v0.1

**首个独立网页游戏与比赛成绩通信验证版本**（完全原创 HTML/CSS/JS，不依赖第三方游戏源码）。适合 Windows 11、Node.js 22+ 和手机 QQ 内置浏览器。

## 功能

- 真实可玩的 10×20 落块、七袋方块随机、移动旋转、软降硬降、消行计分。
- 移动端五个触控按钮、电脑键盘操作，90 秒一局（服务器创建房间时可改时长）。
- 达妮娅模拟比分，按时间增长；AI **不需要**实时操作。
- 静态 GitHub Pages 演示模式（不需要服务器，不会同步 QQ）。
- Node.js 独立测试 API：Bridge 创建房间、玩家结束时提交**可重放操作记录**、后端复算积分、Bridge 拉取比赛结果。
- 全部成绩只用于通信验证，不发好感度，不修改你的 qq-human-bridge。

## 目录

```text
/docs/index.html       GitHub Pages 页面
/docs/style.css        响应式样式
/docs/engine.js        确定性方块规则（网页和 Node 复用）
/docs/app.js           页面逻辑、游戏渲染、调用 API
/docs/config.js        公开 API 地址（绝对不存密钥）
/server/server.mjs     Node 后端，默认只监听本机
/server/create-room.mjs  创建测试房间
/server/bridge-poll.mjs  模拟 Bridge 接收结果
/server/Start-Local-Server.cmd  双击启动本地 API
/tests                 回放与 API 测试
```

## 第一步：发布公开网页

GitHub 新建 **Public** 仓库 `daniya-block-pk`（空仓库，不要初始化 README）。将 ZIP 解压后的**项目根目录全部文件**提交到新仓库的 `main` 分支。详细步骤见 `GITHUB-PUBLISH.md`。

进入 GitHub 项目 **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: main → Folder: /docs → Save**。

发布后，预计游戏地址为：

`https://yueling043210-cpu.github.io/daniya-block-pk/`

**该 URL 是发布完成后的预期地址，当前不代表已经上线。** 中国大陆 QQ 需实际测试你自己的新网址。

没有部署 API 时会显示“体验模式”，可以玩但**不会上传真实分数**。

## 第二步：本机验证分数收取（不需要公网）

在 Windows PowerShell 中：

```powershell
cd "C:\path\to\daniya-block-pk"
node --version
node --test
node server/server.mjs
```

或双击 `server\Start-Local-Server.cmd`。首次启动自动在 `server-data/bridge-secret.txt` 创建**仅供本地工具使用**的 64 字符密钥（该目录被 `.gitignore` 排除）。

保持服务器窗口打开，新开 PowerShell：

```powershell
cd "C:\path\to\daniya-block-pk"
node server/create-room.mjs 1058380864 2820758373 测试玩家 15
```

复制输出的本机房间链接，用**这台电脑**的浏览器打开，进行一局 15 秒测试。结束后：

```powershell
node server/bridge-poll.mjs
```

可以看到玩家分数、达妮娅模拟分数、胜负和 `replay=true`。只是输出日志，不发送 QQ，也**不修改任何好感度**。

如果确认读取成功，可手动标记已读：

```powershell
node server/bridge-poll.mjs --ack
```

> `http://127.0.0.1:8787` 是本机地址，不能直接发给中国大陆的 QQ 群友使用。

## 第三步：连接公网 HTTPS API（后续阶段）

必须单独部署 Node 后端到一个大陆用户能访问的 HTTPS 域名（可选择腾讯云香港或其他合适的正式服务；实际访问效果需测试）。GitHub Pages **不会运行 Node 后端**。

在生产机器配置环境变量 `PUBLIC_GAME_URL=https://yueling043210-cpu.github.io/daniya-block-pk/`、`PUBLIC_API_URL=https://你的API域名`、`WEB_ORIGIN=https://yueling043210-cpu.github.io`、`BRIDGE_SECRET=长度足够的随机密钥`、`HOST=127.0.0.1`，让 Nginx/Caddy 代理到本地端口 8787。不要将后端直接暴露无 TLS 的 HTTP。

在 `docs/config.js` 填写**公开的 HTTPS API 根地址**，重新提交 GitHub Pages。

Windows Bridge 将来通过 `https://你的API域名/api/bridge/results` 主动拉取结果，密钥只保存在 Windows 服务端。当前的 `server/bridge-poll.mjs` 是一个不修改现有 Bridge 的演示工具。

## 安全边界

- 前端链接中的 `ticket` 是一次性房间凭据，持有人可参加比赛，**不等于验证过 QQ 身份**。正式积分还需 QQ 侧签发与完成确认，防转发冒领。
- 服务端会根据随机种子和操作记录重新计算分数，阻止伪造一个不同的数字；但恶意客户端仍可能合成看似合理的操作，因此这**不是完整反作弊机制**。
- 比赛结果带 `affectionEligible:false`，不得直接用于游戏大类加分。
- `server-data/` 及任何 Bridge 密钥、QQ 身份资料、SQLite 或 Core 都不能上传到公开仓库。
- Node 默认绑定 `127.0.0.1`，不是公网部署。公网需要限流、TLS、身份绑定及监控。
- 页面不收集密码，不要求群友使用 GitHub 登录。

© 2026 Daniya Block PK contributors. MIT 许可证见 `LICENSE`。


## v0.1.3 达妮娅难度

体验模式可选择「简单 / 中等 / 困难」，默认简单。按方块实际放置速度（PPS）模拟，网页比分每 1.5～3 秒显示一次结果。

- 简单：0.18～0.30 PPS（慢速体验）
- 中等：0.46～0.72 PPS（休闲玩家）
- 困难：6.20～6.80 PPS（接近顶级 40 行竞速速度；注意这不是 1 分钟分数纪录，也不等于世界冠军的稳定长局成绩）

以上均为设计参数，并非官方难度分级。比分采用玩家同样的下落计分和随等级增长的消行计分；高难度可能在较短时间内得到大量分数。达妮娅只是模拟对手，没有真实落块棋盘。

正式房间由可信 Bridge 服务端在创建时设置 difficulty=easy / medium / hard，启动后锁定，浏览器不能随意修改服务器确认的难度。创建例子：

```powershell
node server/create-room.mjs 1058380864 2820758373 测试玩家 15 medium
```

GitHub Pages 只提供体验游戏，没有真实 QQ 回调，也不涉及好感积分。

## v0.2.0 · 正式界面（网站仍为体验版）

比分牌位于页面顶部；下方是棋盘、NEXT PIECE 与可展开的三档难度：

- 简单 · 犯困的水蜜桃
- 中等 · 认真的娅娅
- 困难 · 终极邪恶水蜜桃（以竞速选手速度模拟，不代表真实世界纪录分数）

开始比赛后，每八秒出现一次随机滚动台词；玩家领先、达妮娅领先、反超时还会触发额外台词。比赛结束时直接在棋盘中央显示获胜者并提供重开按钮。移动端操作键以下不再放结果卡片或页脚。

模拟台词完全在浏览器本地运行，没有调用 AI，不改变比赛积分。新的弹幕选择逻辑在 `docs/barrage.js`，可以编辑其文本池。网站仍属于静态体验版：除非配置自己拥有的 HTTPS 后端与一次性房间链接，否则比赛成绩不会传送至 QQ，也不会发放好感度。

运行 `node --test` 检查旧游戏和服务器兼容性及新版页面逻辑。


## v0.2.2 interface update

- Single native difficulty dropdown; disabled during play and after match end.
- DENIA LIVE chat feed beneath difficulty, bounded height and auto-scrolled every 8 seconds with additional lead-change reactions.
- Each game uses its game seed to generate varied, reproducible opponent scores. The server independently computes the same score.
- End-of-match winner overlay freezes final scoreboard; no separate bottom status/restart bar.
- Demo remains local; no QQ / affection integration in this release.

## v0.2.3: compact rose UI and top-out priority

- All live-chat bubbles use one muted dark-rose color and show the name `达妮娅`.
- The `开始挑战` button has a flat peach-pink fill; the difficulty menu contains only the three persona names.
- The chat panel expands into the freed space below the compact selector.
- **Top-out is an immediate loss regardless of player score**, both in the browser and in the API's deterministic replay verification; the result includes `topOut` / `endReason`.
- A special top-out comment appears in the live chat. Time-limited matches without top-out still compare player and simulated-opponent scores normally.
- This does not enable QQ rewards. The public browser build remains a local exhibition until a trusted server is deployed.


## v0.2.4 单局入场与成绩

- 弹窗仅展示中文胜负和双方得分；无再来一局按钮。刷新体验页面可以另玩一局，但已结算的联网房间不可复用。
- QQ Bridge 生成房间后，30 秒内必须点击开始；否则该房间过期（只限制入场，不截断已开始的 90 秒比赛）。
- 仅一个浏览器会话可以开始；第二个不同浏览器会话尝试开始或提交会使整局无效，成绩不会进入待处理结果。
- QQ 浏览器链接预览不会自动占用房间：只有点击开始挑战才会认领。
- 本地独立比赛服务保存通过复算的玩家/达妮娅分数到 server-data/matches.json，Bridge 可以凭密钥读取。
- **GitHub Pages 本身不能接收分数；未配置 PUBLIC HTTPS API 的网站仍是本地体验模式，不能向 Windows 上传成绩。**
- 还没有 QQ 身份认证，比赛结果 `qqIdentityVerified=false` 且 `affectionEligible=false`，不发放正式好感度。
