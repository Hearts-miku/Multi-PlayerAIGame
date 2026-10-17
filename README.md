# 同桌 · Multi-PlayerAIGame

一个可继续扩展的多人在线小游戏项目。首个游戏是实时双人五子棋，界面支持中文和手机浏览器。

## 已实现

- 账号注册、登录、退出；昵称展示；SQLite 持久化账号与会话。
- scrypt 加盐密码哈希；随机会话令牌仅通过 HttpOnly / SameSite=Strict Cookie 传递，数据库只保存令牌摘要。
- 登录和注册限流、来源检查、请求体大小限制；Socket.IO 握手及每次操作验证会话，退出时断开对应会话的连接。
- 登录玩家大厅、在线人数、创建房间、房间码/邀请链接加入、同账号多页同步。
- 15×15 实时五子棋：黑棋先手、服务器验证轮次/坐标/占位/成员身份、四方向五连与长连获胜、满盘和棋。
- 认输、双方同意后交换黑白再战、刷新和网络重连恢复棋局。
- 响应式大厅与棋盘；胜利连线和最后落子标记。

## 本地启动

需要 **Node.js 24+**，使用其内置 `node:sqlite`。该模块在部分 Node.js 24 版本中仍会显示实验性提示。

```bash
npm ci
npm run dev
```

打开 [http://localhost:5173](http://localhost:5173)。后端默认监听 3000，Vite 代理 API 和 Socket.IO 请求。两个玩家请使用不同浏览器或一个普通窗口加一个隐身窗口，分别注册账号。普通浏览器的多个标签共享登录会话。

也可以运行构建后的完整应用：

```bash
npm run build
npm start
```

打开 [http://localhost:3000](http://localhost:3000)。第一位玩家创建房间，第二位输入房间码加入；邀请链接会自动填入房间码，登录后点击“加入房间”。

## 配置

复制 `.env.example` 为 `.env`，服务启动时会自动读取。真实配置、数据库及依赖目录均已忽略，不提交到仓库。

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PORT` | `3000` | 后端端口 |
| `HOST` | `0.0.0.0` | 监听地址 |
| `DATABASE_PATH` | `./data/game.sqlite` | SQLite 文件位置 |
| `APP_ORIGIN` | `http://localhost:3000,http://localhost:5173` | 逗号分隔的准确浏览器来源，不带路径或末尾斜线 |
| `COOKIE_SECURE` | `false` | HTTPS 部署时设为 `true` |
| `TRUST_PROXY` | `0` | 仅在恰好一个受信反向代理之后设为 `1` |

局域网联机时，向 `APP_ORIGIN` 加入实际访问地址，例如 `http://192.168.1.10:3000`，重启后通过该地址访问，并确保防火墙允许相应端口。localhost 邀请链接只能在本机使用；请用朋友能访问的地址打开页面后复制邀请。

## 部署

仓库提供 Dockerfile。应用需要常驻 Node.js 服务和 WebSocket 支持，不能直接部署到 GitHub Pages。

```bash
docker build -t multiplayer-game .
docker run -d --name multiplayer-game -p 127.0.0.1:3000:3000 \
  -v multiplayer-game-data:/app/data \
  -e APP_ORIGIN=https://games.example.com \
  -e COOKIE_SECURE=true \
  -e TRUST_PROXY=1 \
  multiplayer-game
```

上例须在本机配置一个 HTTPS 反向代理，将该域名转发至 3000 并转发 WebSocket Upgrade、Origin 和客户端 IP 头。`NODE_ENV=production` 时启动会强制检查 HTTPS 来源和 Secure Cookie。没有反向代理时保留 `TRUST_PROXY=0`。不要将受信代理之后的后端端口额外暴露到公网。

备份 SQLite 时请停止应用后复制整个 `data` 目录，或使用 SQLite 在线备份接口，避免只复制 WAL 模式下的主文件。

## 验证

```bash
npm test
npm run build
npx playwright install chromium
npm run test:browser
```

Windows 已安装 Edge 时可跳过浏览器下载：

```powershell
$env:PLAYWRIGHT_CHANNEL = 'msedge'
npm run test:browser
```

`npm test` 包括规则单元测试，以及使用真实 HTTP 和 Socket.IO 连接的账号、权限、完整胜局、重连、再战、退出撤销和数据库重开测试。浏览器测试使用桌面与手机尺寸的两个独立会话，验证注册、大厅、九手胜局、刷新恢复、再战和退出，截图输出到忽略的 `test-results/`。CI 执行这些测试和生产构建。

## 项目结构

```text
server/
  app.js       HTTP、登录验证、实时事件与权限
  store.js     用户、密码哈希与持久会话
  game.js      五子棋规则和房间状态
  index.js     环境配置和服务启动
src/
  main.jsx     登录、大厅、房间与棋盘
  style.css    响应式界面
tests/
  game.test.js          规则测试
  integration.test.js   HTTP 与双人实时集成测试
  browser/game.spec.js  双浏览器端到端测试
```

后续游戏可以增加独立规则模块，再接入大厅入口与对应实时事件。身份验证与会话层可以复用。

## 首版边界

- 房间对所有登录玩家可见，首版没有私密房、观战、聊天、AI 对手或匹配排位。
- 棋局在单进程内存中保存，**服务器重启会清空棋局**，账号和未过期会话仍保留。双方离线且一小时未操作的房间会定期清理；没有落子倒计时。
- 离开房间会关闭双方棋桌。断线或退出登录不会立即关闭棋局，同账号重新登录可恢复。
- 当前用于单实例运行；多实例部署前需共享房间状态、事件适配器和限流存储。
- 不含邮箱验证、找回密码和账号管理后台；请妥善保存账号密码。
- GitHub 代码发布与公网游戏部署是两个独立步骤，本项目未预置任何服务器或域名。

参考官方文档：[Socket.IO 中间件](https://socket.io/docs/v4/middlewares/)、[Node.js SQLite](https://nodejs.org/docs/latest-v24.x/api/sqlite.html)。
