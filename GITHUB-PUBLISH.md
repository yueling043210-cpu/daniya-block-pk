# Windows 11 通过 GitHub 上传并启用 Pages

帐号：`yueling043210-cpu`；建议仓库名：`daniya-block-pk`。

## A. 创建空仓库

1. 登录 https://github.com/new 。
2. Repository name: `daniya-block-pk`，Visibility: **Public**。
3. 不勾选 Initialize with README / .gitignore / license（ZIP 已有这些文件）。
4. 点击 Create repository。

## B. 上传项目（推荐 GitHub Desktop，或已安装的 Git 命令）

先将 ZIP 解压，例如 `C:\Users\86135\Desktop\daniya-block-pk-v01`。不要直接上传 ZIP 文件本身到仓库根目录。

若你已安装 Git，在该文件夹打开 PowerShell：

```powershell
git init
git branch -M main
git add .
git commit -m "Initial Daniya Block PK prototype"
git remote add origin https://github.com/yueling043210-cpu/daniya-block-pk.git
git push -u origin main
```

首次推送可能需要通过浏览器登录 GitHub；GitHub 不接受账户密码作为 Git HTTPS 密码。若未安装 Git，可使用 GitHub Desktop 的 **Add existing repository / Publish repository**，或通过 GitHub 网页逐个上传文件与文件夹。

**务必确认** GitHub 上有 `docs/index.html`、`docs/engine.js`、`docs/app.js`、`docs/style.css`、`docs/config.js`。

## C. 发布 Pages

1. 打开 `https://github.com/yueling043210-cpu/daniya-block-pk`。
2. **Settings → Pages**。
3. **Source: Deploy from a branch**。
4. **Branch: main**、**Folder: /docs**，Save。
5. 等几分钟再打开 Pages 面板显示的正式 URL。

预期地址：`https://yueling043210-cpu.github.io/daniya-block-pk/`。

请使用中国大陆的真实 QQ 测试这个**新地址**。第三方 GitHub Pages 游戏可以打开，不等于新地址被 QQ 永久允许。

## D. 验证前后端的区别

GitHub Pages 发布成功时：**方块游戏能玩，对手分数会动，但只在本机体验**。

没有部署公网 HTTPS API 前，**分数不会自动回传给 Windows QQ Bridge**。

本地服务器通信测试按 README 第 2 步运行；QQ 内实测与真实服务器部署属于下一阶段。

### 一键辅助推送（可选）

项目根目录还有 `Publish-To-GitHub.cmd`，会先检查 Git 是否安装、仓库地址、密钥文件，并列出待上传文件。**只有在明确输入 `PUBLISH` 后**才提交并推送；不会自动登录 GitHub 或创建仓库。若你的远程仓库名称不是 `daniya-block-pk`，请改用手工 Git 命令并自行调整远程地址。
