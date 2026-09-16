# Words to Website

线下活动系统：参与者说一段话，AI 生成网页并发布，凭凭证页集章。

## 快速开始

```bash
pnpm install
cp .env.example .env   # 默认全 mock 模式，零外部依赖
pnpm dev               # 前端 :5173(代理 API 到 :3000)
```

手机访问 `http://<局域网IP>:5173`(真机麦克风需 HTTPS，本地演练可用打字模式)。

## 常用命令

| 命令 | 说明 |
|---|---|
| `pnpm dev` | 前后端同时热重载开发 |
| `pnpm build` | 构建 web + server |
| `pnpm start` | pm2 生产启动（先 `pnpm build`，配好 `.env`） |
| `pnpm mock:publish` | 本地 mock 发布服务（:9090，模拟活动方 POST 接口） |
| `pnpm seed` | 造 10 个测试任务压测队列 |

## 模式切换（.env）

- `GENERATION_PROVIDER=codex|mock` — mock 无需 codex,3s 出示例页
- `WHISPER_PROVIDER=openai-api|local|mock` — 语音转写
- `PUBLISH_ENDPOINT` — 留空走内置 mock 发布；填活动方接口走真实发布
- `CODEX_BASE_URL` + `CODEX_API_KEY` — codex 自定义接入（中转/网关），不配则用服务器 codex 登录态
- `VITE_API_BASE` — 前端请求的后端地址（留空同源；Pages 等异地部署时填后端 https 域名，后端配 `ALLOWED_ORIGINS` 放行跨域）

## 页面

- `/` — 参与者流程（录音 → 确认 → 排队 → 预览 → 修改 → 发布 → 凭证）
- `/verify/W2S-XXXX` — 工作人员扫码核验页
- `/admin` — 管理台（密码 = `ADMIN_PASSWORD`）：指标 / 会话池 / 任务表 / 重试 / codex 探活

## 部署（远程服务器）

1. 装 Node 22 + pnpm + pm2 + Caddy，服务器 codex 已安装并登录（或配 `CODEX_BASE_URL/API_KEY`）
2. `pnpm install && pnpm build`，配好 `.env`(域名、`PUBLIC_BASE_URL`)
3. `pm2 start deploy/ecosystem.config.js && pm2 save`
4. Caddy：改 `deploy/Caddyfile` 域名，`sudo caddy run --config deploy/Caddyfile`(自动 HTTPS)

也可用腾讯云 EdgeOne 做边缘接入（HTTPS＋加速，可替代 Caddy）或 Pages 托管演示版，见 `deploy/edgeone.md`。

### Docker（后端 + 自托管转写）

镜像是纯后端（不含前端构建产物），内置 codex CLI（`CODEX_BASE_URL`/`CODEX_API_KEY` 认证）：

```bash
cp .env.example .env   # 按需改（codex 接入、ADMIN_PASSWORD、发布模板等）
docker compose up -d   # server + speaches（OpenAI 兼容转写服务）一键编排
```

镜像由 GitHub Actions 自动发布到 `ghcr.io/comppsyunion/words2site`（push main → `latest`，tag `v*` → 语义化版本，PR 只构建不推送）。前端配 `VITE_API_BASE=https://<后端域名>` 即可异地部署（见 `deploy/edgeone.md` 方案 B-2）。

## 演练

完整清单见 `apps/server/scripts/e2e.md`(mock 全链路 / 超时注入 / 杀进程恢复 / 真实 codex 压测 / 发布联调)。

> 活动方发布接口文档到手后，只需改 `apps/server/src/services/publisher.ts`。
