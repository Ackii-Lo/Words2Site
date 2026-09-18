# 端到端演练清单（e2e）

## A. 本地 mock 全链路（零外部依赖）

- [ ] `.env`:`GENERATION_PROVIDER=mock`、`PUBLISH_ENDPOINT=`(空，走内置 mock)
- [ ] `pnpm mock:publish` 另开终端（若要演练真实 POST 发布链路，把 `PUBLISH_ENDPOINT=http://localhost:9090/publish` 填进 .env）
- [ ] `pnpm dev`，手机/浏览器打开 http://localhost:5173
- [ ] 填写描述 + 邮箱 + 网址 → 提交 → 排队 → 自动发布（mock 页面）→ 凭证页（编号 + 二维码）
- [ ] mock 产物无署名 → 任务日志出现「已注入兜底页脚」
- [ ] 扫码/打开 /verify/W2S-XXXX → 核验页信息正确

## B. 异常注入

- [ ] `GEN_TIMEOUT_MS=5000` + codex 模式：任务超时 → 自动重试 → 最终 failed，提示文案友好
- [ ] mock:publish 返回 500(临时改 mock 脚本):publish 报错可重试，admin 可见
- [ ] 生成中途 `Ctrl+C` 杀服务再启动：中断任务标记 failed(server restarted),admin 重试成功
- [ ] admin 强杀一个 generating 会话：任务失败重试，无孤儿 codex 进程（`ps aux | grep codex`）

## C. 真实 codex(服务器)

- [ ] 官方登录态：`codex exec "say ok"` 通过，admin 探活绿
- [ ] 自定义接入：`CODEX_BASE_URL` + `CODEX_API_KEY` 配置后探活通过
- [ ] 单任务真实生成 < 4 分钟，产物通过校验（无外链、单文件）
- [ ] 3 台手机同时提交：排队位置正确、并发 = MAX_CONCURRENT、SessionBoard 实时刷新
- [ ] `pnpm seed` 10 连发：无进程残留、admin 指标合理

## D. 发布接口联调（活动方文档到手后）

- [ ] 按文档改 `apps/server/src/services/publisher.ts` 的请求构造/响应解析
- [ ] 真实接口发布成功，返回 URL 手机可打开
- [ ] url flag 语义确认（多目标发布？）
