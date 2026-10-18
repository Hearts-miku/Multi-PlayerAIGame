# 同桌 · Multi-PlayerAIGame

一个可继续扩展的多人在线小游戏项目。目前包含实时双人五子棋，以及支持双人对战和合作的贪食蛇，界面支持中文和手机浏览器。

## 已实现

- 账号注册、登录、退出；昵称展示；本地默认 SQLite，Vercel 使用 Redis 持久化账号、会话与棋局。
- scrypt 加盐密码哈希；随机会话令牌仅通过 HttpOnly / SameSite=Strict Cookie 传递，数据库只保存令牌摘要。
- 登录和注册限流、来源检查、请求体大小限制；Socket.IO 握手及每次操作验证会话，退出时断开对应会话的连接。
- 登录玩家大厅、在线人数、创建房间、房间码/邀请链接加入、同账号多页同步。
- 15×15 实时五子棋：黑棋先手、服务器验证轮次/坐标/占位/成员身份、四方向五连与长连获胜、满盘和棋。
- 认输、双方同意后交换黑白再战、刷新和网络重连恢复棋局。Redis 模式支持多实例原子落子、共享在线状态和跨实例退出撤销。
- 响应式大厅与棋盘；胜利连线和最后落子标记。
- 24×24 双人贪食蛇：服务器每 300 毫秒推进一次，方向键 / WASD / 手机方向按钮操作；双方准备后倒数 3 秒。
- 贪食蛇对战模式：碰撞者淘汰，双方同帧碰撞为平局；合作模式：共同收集 20 个食物成功，任意一条蛇碰撞则失败。
- 贪食蛇断线或同步停顿后暂停，保留位置与分数，双方重新准备继续。Redis 原子提交防止多实例重复推进同一帧。

## 本地启动

需要 **Node.js 24.x**，使用其内置 `node:sqlite`。该模块在部分 Node.js 24 版本中仍会显示实验性提示。

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

贪食蛇在大厅有“双人对战”和“双人合作”两个入口。两位玩家分别控制绿色蛇和蓝色蛇，入场后都点击“准备开始”；每步最多转向一次，不能直接掉头。撞墙、撞自身或对方身体均算碰撞。对战比生存，合作累计双方得分；结束后双方同意可再来一局，重新准备后开始。离开房间会关闭双方的房间。

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
| `REDIS_URL` | 未设置 | 设置 `rediss://` 连接后启用共享持久存储 |
| `REDIS_PREFIX` | `tongzhuo:v1:` | Redis 键命名空间；Vercel Preview 默认使用独立的 `tongzhuo:preview:v1:` |

局域网联机时，向 `APP_ORIGIN` 加入实际访问地址，例如 `http://192.168.1.10:3000`，重启后通过该地址访问，并确保防火墙允许相应端口。localhost 邀请链接只能在本机使用；请用朋友能访问的地址打开页面后复制邀请。

## 部署

### Vercel

前端由 Vite 构建到 `dist`，`api/server.js` 导出 HTTP/WebSocket 服务。`vercel.json` 开启 Fluid Compute，HTTP API 重写到该函数；Socket.IO 直接连接 `/api/server`，关闭自动追加斜线。默认东京区域，函数最大执行时间 300 秒；客户端在连接中断后自动重连并重新读取 Redis 中的棋局。Redis 连接在收到请求时初始化，避免预热期间连接超时永久阻断后续请求。

部署必须配置 `REDIS_URL` 和 HTTPS `APP_ORIGIN`。Vercel 运行时强制启用 Secure Cookie，禁止回退到临时 SQLite。当前已连接 Vercel Marketplace 的 Upstash Redis Free 计划，关闭 `autoUpgrade`、`eviction` 和 `prodPack`；达到免费额度后可能暂时无法操作，不自动升级付费。免费额度以控制台为准。

在线地址：[https://www.hearts-ai.top](https://www.hearts-ai.top)。项目在个人空间内名为 `multi-playeraigame`，根域名 `hearts-ai.top` 保留跳转到 `www`。首次安装数据库需要账号所有者接受供应商条款。生产与预览的 Redis 前缀不同；本地云端测试使用随机测试前缀，测试结束后仅清理该前缀。

```bash
vercel link
vercel env pull .env.local
npm run test:redis
vercel deploy --prod --skip-domain
# 验证账号、真实双人对局、重连与退出后再发布：
vercel promote <deployment-url>
```

开发模式不会自动读取 `.env.local` 中的云端凭据，避免普通本地测试访问生产数据。`test:redis` 会明确读取该文件并使用独立命名空间。

贪食蛇只在有玩家连接的实例中推进，状态通过 Redis 同步；运行中的对局比回合制五子棋消耗更多 Redis 命令。房间为空或暂停时不会持续写入游戏帧，免费额度与关闭自动升级的配置保持不变。

### Docker / 常驻服务器

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

验证已部署的网站时设置 `LIVE_BASE_URL=https://www.hearts-ai.top` 再运行浏览器测试。测试会创建随机账号和临时棋桌，完成后关闭棋桌并退出；随机测试账号会保留。受保护的候选部署可使用环境中的 `VERCEL_AUTOMATION_BYPASS_SECRET`，仅向目标站点发送，不写入代码或报告。

`npm test` 包括规则单元测试，以及使用真实 HTTP 和 Socket.IO 连接的账号、权限、完整胜局、重连、再战、退出撤销和数据库重开测试。浏览器测试使用桌面与手机尺寸的两个独立会话，验证注册、大厅、九手胜局、刷新恢复、再战和退出，截图输出到忽略的 `test-results/`。CI 执行这些测试和生产构建。`npm run test:redis` 另外验证真实 Redis 上两个独立服务实例的对战、并发互斥、服务重启恢复和跨实例会话撤销；没有配置 Redis 时普通测试明确跳过该项。

贪食蛇另覆盖墙体、自撞、对方身体、迎头相撞、交换头部位置、尾部让位和成长尾部碰撞、合作达标与失败、暂停恢复。Socket.IO 集成测试通过服务器侧临近目标的测试数据验证合作胜利广播；浏览器测试不修改分数，实际验证两种模式的转向、吃食物、断线恢复、碰撞结算和再战。Redis 测试验证分属两个实例的玩家收到相同帧，以及并发推进只提交一次。

## 项目结构

```text
server/
  app.js       HTTP、登录验证、实时事件与权限
  store.js     用户、密码哈希与持久会话
  game.js      通用房间生命周期与游戏规则分发
  game-rules.js 游戏规则注册表
  gomoku.js    五子棋独立规则
  snake.js     双人贪食蛇推进、碰撞和两种模式规则
  index.js     环境配置和服务启动
src/
  main.jsx     登录、大厅与通用房间入口
  game-views.js 游戏界面注册表
  Gomoku.jsx   五子棋卡片、棋盘与对局
  Snake.jsx    贪食蛇入口、场地与键盘/触屏控制
  style.css    响应式界面
tests/
  game.test.js          规则测试
  integration.test.js   HTTP 与双人实时集成测试
  browser/game.spec.js  双浏览器端到端测试
```

新增游戏请遵循 [接入与回归规范](docs/adding-games.md)：独立规则和界面模块，明确游戏 ID 分发，保留全部旧游戏回归。公开模式定义位于 `shared/games.js`，卡片和模式弹窗由注册表驱动。

## 首版边界

- 房间对所有登录玩家可见，首版没有私密房、观战、聊天、AI 对手或匹配排位。
- 本地 SQLite 模式的棋局仍在内存中，服务重启会清空。Redis 模式下账号、会话和棋局跨服务重启保留；房间连续 24 小时无操作后过期，登录会话 7 天过期；没有落子倒计时。
- 离开房间会关闭双方棋桌。断线或退出登录不会立即关闭棋局，同账号重新登录可恢复。
- Redis 模式共享房间、限流、在线状态及消息通知。落子采用原子比较并交换；订阅短暂中断后，客户端重连或周期同步会重新加载权威棋局。
- 不含邮箱验证、找回密码和账号管理后台；请妥善保存账号密码。
- `.env*`、`.vercel`、数据库、缓存和 CLI 登录信息不提交至 Git，也不上传部署源码。

参考官方文档：[Socket.IO 中间件](https://socket.io/docs/v4/middlewares/)、[Node.js SQLite](https://nodejs.org/docs/latest-v24.x/api/sqlite.html)。
