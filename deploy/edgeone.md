# EdgeOne 部署指南

本项目支持两种腾讯云 EdgeOne 部署形态，按场景选用：

| 形态                             | 适用场景                                            | 功能完整性                                 |
| -------------------------------- | --------------------------------------------------- | ------------------------------------------ |
| 方案 A：接入加速（边缘反向代理） | 正式活动，源站保持 pm2 部署                         | 完整（录音 / 生成 / 发布 / 核验 / 管理台） |
| 方案 B：Pages 静态托管           | 路演展示（无源站），或前端托管 Pages + 后端走方案 A | B-1 纯演示；B-2 连远程后端跑完整流程       |

## 为什么方案 A 可行

对代码的三个事实决定了 EdgeOne 接入是透明的：

- 前端所有 API 调用均为同源相对路径（`/api/…`、`/preview/…`），生产模式下由 Express（:3000）同时托管 SPA、API 与已发布页面，边缘层只需把请求原样回源即可；
- 前后端之间没有 WebSocket / SSE，队列与状态全部靠 HTTP 轮询，边缘无需任何长连接配置；
- 麦克风权限要求 secure context，EdgeOne 边缘自带 HTTPS（免费证书），可完整替代 Caddy 的自动 HTTPS 职责。

## 方案 A：接入加速（推荐）

### 前置条件

- 腾讯云账号，已开通 [EdgeOne](https://console.cloud.tencent.com/edgeone)；
- 一个域名（如 `words2site.example.com`），DNS 解析可控；
- **加速区域若包含中国大陆，域名必须已完成 ICP 备案**；仅境外加速则不需要；
- 源站服务器上 `pnpm build && pm2 start deploy/ecosystem.config.js` 已跑通，`:3000` 可在本机访问。

### 步骤 1：添加站点与加速域名

控制台「站点加速」→ 添加站点 → 输入主域（如 `example.com`），按需选择套餐与加速区域，接入模式选 **CNAME 接入**（保持现有 DNS 服务商，只加一条解析，最省事）。

随后在站点内添加加速域名 `words2site.example.com`。

### 步骤 2：CNAME 解析与免费证书

到 DNS 服务商添加：

```text
words2site.example.com  CNAME  <控制台分配的 CNAME 地址>
```

注意：CNAME 接入时 EdgeOne 会自动为域名申请免费 DV 证书，**CA 验证依赖这条 CNAME，须在申请发起后 1 小时内配置生效**，超时验证失败需在控制台重新触发。生效后 HTTPS 由边缘节点终止，客户端到边缘即为加密（麦克风可用）。

### 步骤 3：回源配置

「源站」中把源站类型设为 IP，填写源站服务器公网 IP；回源协议选 **HTTP**，回源端口填 **3000**（EdgeOne 默认 HTTP 回源走 80 端口，自定义端口需确保源站防火墙放行）。

此方案下源站直接暴露的是 Express，Caddy 可以退役；若想保留 Caddy（例如同机还有别的站点），改为 EdgeOne 回源 443、Caddy 继续反代 3000 也可以，二选一即可。

### 步骤 4：缓存规则（关键）

在「缓存规则 / 规则引擎」中按路径区分，缓存错配会直接导致功能异常：

| 匹配                      | 策略               | 原因                                         |
| ------------------------- | ------------------ | -------------------------------------------- |
| URL 路径 前缀 `/api/`     | 不缓存             | 任务队列、管理台全部走这里，缓存会让状态僵死 |
| URL 路径 前缀 `/preview/` | 不缓存（或 ≤ 60s） | 参与者刚发布的页面必须立即可见               |
| URL 路径 前缀 `/assets/`  | 遵循源站 / 长缓存  | Vite 产物带内容 hash，可放心缓存 30 天       |
| 其余（HTML）              | 不缓存             | SPA 入口，发布后要立即拿到新版本             |

### 步骤 5：上传体积上限

录音转写接口（`/api/transcribe`）上传音频，multer 限制单文件 10MB。EdgeOne 侧确认「最大上传大小」≥ 20MB（留余量），不足时边缘会直接返回 413，与源站无关——这是接入后最常见的事故点，可参考[上传大小限制配置](https://edgeone.ai/zh/document/46172)。

### 步骤 6：源站防护（建议）

在源站防火墙关闭 3000 端口的公网直连，仅放行 [EdgeOne 回源 IP 网段](https://cloud.tencent.com/document/product/1552/76086)，避免有人绕过边缘直接打源站。

### 步骤 7：更新配置并验证

`.env` 中把 `PUBLIC_BASE_URL` 改为 `https://words2site.example.com`（凭证二维码与 `/verify` 链接用它生成），然后 `pm2 restart words2site`。

验证清单：

- [ ] `https://<域名>` 能打开，浏览器地址栏无证书告警；
- [ ] 首页能唤起麦克风并录音（secure context 生效）；
- [ ] mock 模式走完 录音 → 确认 → 排队 → 发布 → 凭证 全链路（`GENERATION_PROVIDER=mock`）；
- [ ] 凭证页二维码指向 `https://` 域名，扫码后 `/verify/W2S-XXXX` 正常核验；
- [ ] `/admin` 可登录，任务表 3 秒轮询数据在动（说明 `/api/` 未被缓存）；
- [ ] 上传一段 > 5MB 的音频转写不报 413。

## 方案 B：Pages 静态托管

把前端静态产物托管到 [EdgeOne Pages](https://edgeone.ai/pages)（免费），按是否连后端分两档：

| 档位                 | 额外配置                            | 效果                                           |
| -------------------- | ----------------------------------- | ---------------------------------------------- |
| B-1 纯演示（无后端） | 无                                  | 仅大屏演示模式，主流程不可用                   |
| B-2 连远程后端       | `VITE_API_BASE` + `ALLOWED_ORIGINS` | 完整流程（录音 / 生成 / 发布 / 核验 / 管理台） |

前端默认走同源相对路径 `/api/…`（开发由 Vite 代理、生产由 Express 同域托管）；构建期环境变量 `VITE_API_BASE` 会把全部请求与 iframe 预览指向远程后端，两档随时可切换。

### 方式一：CLI 部署

```bash
pnpm install --frozen-lockfile
pnpm --filter @words2site/web build   # 产物在 apps/web/dist
npm install -g edgeone
edgeone pages deploy apps/web/dist
```

monorepo 场景建议像上面这样先本地构建、再对 `dist` 目录部署，避免 CLI 自动构建时无法识别 pnpm workspace。

### 方式二：控制台 Git 连接

Pages 控制台 → 创建项目 → 导入 Git 仓库，安装与构建是两个独立配置项，分别填：

```text
安装命令：      pnpm install --frozen-lockfile
构建命令：      pnpm --filter @words2site/web build
输出目录：      apps/web/dist
Node 版本：     22
```

安装命令锁定 `pnpm-lock.yaml`（`--frozen-lockfile`），保证 CI 产物与本地一致；若构建日志提示找不到 `pnpm`，把安装命令改为 `npm install -g pnpm && pnpm install --frozen-lockfile`（仓库 `packageManager` 字段已固定 pnpm 版本）。

推送即自动部署，Pages 会分配默认域名，也可绑定自定义域名。

### SPA 路由回退（必配，仓库已带）

前端是 vue-router **history 模式**，直接访问或刷新子路径（工作人员扫码核验 `/verify/W2S-XXXX`、管理台 `/admin`、大屏 `/screen`）时，静态托管找不到对应文件会返回平台 404。`apps/web/public/edgeone.json` 已配置回退：

```json
{
  "rewrites": [{ "source": "/*", "destination": "/index.html" }]
}
```

文件放在 `apps/web/public/` 下，经 Vite 构建原样复制进**输出目录** `apps/web/dist/`——EdgeOne Pages 从部署产物读取该配置，因此无论控制台的「根目录」设为仓库根还是 `apps/web`，只要输出目录是 `apps/web/dist` 就会生效（CLI 直传 `dist` 目录部署同样带上）。

EdgeOne Pages 把它识别为 SPA fallback：请求先匹配静态资源与函数，未命中时返回 `index.html`，浏览器 URL 保持不变、由前端路由接管。

验证（应返回 200 与 `text/html`）：

```bash
curl -i https://<pages 域名>/screen | head -3
```

注意事项：

- 切勿在产物根目录放 `404.html`——会抢占回退、破坏客户端路由；
- 方案 B 下前端 API 走 `VITE_API_BASE` 跨域直连后端域名，不经 Pages 域名，`/*` 回退不影响接口请求。

### 连接远程后端（B-2，完整流程）

1. 后端必须已可公网 HTTPS 访问（即方案 A 已接好，或源站保留 Caddy 自有证书；后端也可以是 Docker 容器——`ghcr.io/comppsyunion/words2site`，`docker compose up -d` 连 Speaches 转写一起编排）。Pages 是 HTTPS 站点，浏览器禁止其向 `http://` 地址发请求（混合内容限制），因此 `VITE_API_BASE` 必须是 `https://`；
2. 后端 `.env` 设 `ALLOWED_ORIGINS=https://<pages 域名>`（逗号分隔可配多个），`pm2 restart words2site`——后端默认仅同源，不放行则所有请求被浏览器 CORS 拦截；
3. 前端注入后端地址：Pages 项目环境变量加 `VITE_API_BASE=https://<后端域名>` 后重新部署；CLI 本地构建则写进仓库根 `.env` 再执行构建（注意本地 dev 也会读到它而绕过 Vite 代理，届时 `ALLOWED_ORIGINS` 需附带 `http://localhost:5173`）；
4. 验证：首页任务状态正常轮询、`/admin` 能登录（`Authorization` 头跨域预检通过）、录音上传转写成功（multipart 跨域直传，无预检）。

### 访问

- B-1 大屏演示：`https://<pages 域名>/?demo=12`（后端不可达时自动用内置演示卡片填充；老地址 `/screen` 会重定向到 `/`）；
- B-2 制作流程在 `/start`（主入口 `/` 是大屏），正式活动可用。

## 常见问题

- **免费证书一直「验证中」**：九成是 CNAME 没在 1 小时窗口内生效，检查解析是否冲突（同名的 A 记录要先删），然后在控制台重新申请。
- **上传音频 413**：先查 EdgeOne「最大上传大小」，再查源站（若保留 Caddy，`max_request_body` 仍需 ≥ 20MB）。
- **管理台数据不动 / 任务状态不更新**：`/api/` 被缓存了，回步骤 4 修正并清缓存。
- **大陆访问慢或被拒**：加速区域含中国大陆但域名未备案时无法开启，改用「全球（不含中国大陆）」或先完成备案。
- **刷新 `/verify/...`、`/admin` 等子路径 404**：SPA 回退未生效——确认构建产物里有 `edgeone.json`（本地 `pnpm --filter @words2site/web build` 后看 `apps/web/dist/`，见「SPA 路由回退」一节），且产物根目录没有 `404.html`。
- **`/preview` 页面 404**：该路径由源站 `data/published` 目录动态提供，确认走的是方案 A 且回源正常，Pages 形态下无此路径。
- **深链（`/start`、`/verify/xxx`）刷新 404**：SPA 用的是 history 路由，静态托管必须把未命中路径回退到 `index.html`。方案 A（Express 托管）已在服务端做好；方案 B（EdgeOne Pages）需在 Pages 项目里确认「SPA 回退 / 自定义错误页」把 404 指到 `index.html`，否则直开/刷新子路由会白屏 404。
