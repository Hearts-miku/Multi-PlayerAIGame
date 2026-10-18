# 自动发布门禁

生产项目：`multi-playeraigame`（`prj_qBoiYmKImQ06uKdpYleSJEQ3jgeM`）。正式域名：`www.hearts-ai.top`、`hearts-ai.top`。

## 发布顺序

1. 提交触发 GitHub `Verify` 和 Vercel 构建。只有 `main` 是生产分支。
2. `all-game-tests` 启动临时 TLS Redis，执行 `npm test`（包括两项真实 Redis 测试）、生产构建和全套双人浏览器测试。浏览器服务也连接临时 Redis。
3. `release-gate` 使用 `needs: [test]` + `always()`，只有前置结果恰好为 `success` 才成功。失败或跳过不会被伪装为成功；取消/未运行也不能提供成功结果。
4. Vercel 等同一提交的 `release-gate` 成功后才给生产部署分配域名。构建成功但门禁不成功，线上继续使用上一版。

没有 CLI 发布密钥、部署钩子或独立的 CI 发布步骤。Vercel 原生 GitHub 检查读取真实检查结果；Git 构建保留，原先不受测试约束的自动上线路径已受门禁约束。

## Vercel 设置

生产 Deployment Check：

```json
{
  "name": "All game tests must pass",
  "requires": "none",
  "targets": ["production"],
  "blocks": "deployment-alias",
  "source": {
    "kind": "git-provider",
    "provider": "github",
    "externalCheckName": "release-gate"
  },
  "timeout": 1800
}
```

保留 production 自动域名分配开启，由上述检查决定何时分配。此配置保存在 Vercel 项目设置，不是仓库配置；迁移项目必须重新建立并实测。检查名 `release-gate` 是稳定协议，不能随意改名。超时后应调查并重新运行验证/部署，不能强制上线。

## 维护要求

- `release-gate` 不使用 `continue-on-error`；新增测试 job 时必须加入 `needs` 并检查每个结果。
- CI 每次运行独立 Redis 容器，监听 runner 回环端口，正常校验证书；结束后移除。生产数据库和玩家数据不会进入 CI。
- 不使用生产密钥、`pull_request_target`、不可信 dispatch payload 或未经验证的部署 URL。
- 不得 Force Promote、删除检查或手动伪造成功。项目管理员仍有修改设置的权限，门禁不防止管理员主动绕过。
- 检查失败时不要修改正在服务的部署；修复代码/测试后重新提交。
- 新增游戏必须保留所有旧游戏测试。运行成功仅证明已有测试范围，不等于任意新功能零回归。

参考：[Vercel Deployment Checks](https://vercel.com/docs/deployment-checks)。
