import http from "node:http";
import { config } from "../config.js";
import { log } from "../util/logger.js";

/**
 * 本地 LLM 反代（容器内 127.0.0.1）：
 * codex 0.92 的 chat wire 会发 role:"developer"（OpenAI 新格式），自建
 * new-api 网关的上游只认 user/assistant/system；且 NAS 出口对 rustls 的
 * HTTPS 指纹有拦截，只能走内网 HTTP 明文。此代理把请求体里的 developer
 * 改写为 system 后转发 LLM_PROXY_UPSTREAM，响应（含 SSE 流）原样透传。
 * CODEX_BASE_URL 指向 http://127.0.0.1:<port>/v1 即可穿透两个问题。
 */
export function startLlmProxy(): void {
  const upstream = config.llmProxy.upstream;
  if (!upstream) return; // 未配置则不启动（直连官方端点等场景）
  const u = new URL(upstream);
  const port = config.llmProxy.port;

  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("error", () => res.destroy());
    req.on("end", () => {
      let body = Buffer.concat(chunks);
      // 仅对 chat 请求改写（其他路径/非 JSON 原样透传）
      if (req.url?.includes("/chat/completions")) {
        try {
          const json = JSON.parse(body.toString("utf-8")) as {
            messages?: Array<{ role: string }>;
            max_tokens?: number;
            max_completion_tokens?: number;
            max_output_tokens?: number;
          };
          let dirty = false;
          if (Array.isArray(json.messages)) {
            for (const m of json.messages)
              if (m && m.role === "developer") {
                m.role = "system";
                dirty = true;
              }
          }
          // codex 对未知模型（glm-5.3）不带 max_tokens，而网关上游是 Anthropic
          // 协议（max_tokens 必填），new-api 转换时自填小默认（~4k）→ 生成整页
          // HTML 被截断 → finish_reason:"length" → codex 0.92 误报为
          // "ran out of room in the model's context window"。显式给足输出上限。
          const MAX_OUT = 65536;
          const cur =
            json.max_tokens ??
            json.max_completion_tokens ??
            json.max_output_tokens;
          if (cur === undefined || cur < MAX_OUT) {
            if (json.max_completion_tokens !== undefined)
              json.max_completion_tokens = MAX_OUT;
            else if (json.max_output_tokens !== undefined)
              json.max_output_tokens = MAX_OUT;
            else json.max_tokens = MAX_OUT;
            log(
              "llm-proxy",
              `输出上限 ${cur ?? "未带(网关会自填小默认)"} → ${MAX_OUT}（length 截断会被 codex 误判为上下文耗尽）`,
            );
            dirty = true;
          }
          if (dirty) body = Buffer.from(JSON.stringify(json), "utf-8");
        } catch {
          /* 非 JSON body 不动 */
        }
      }
      const headers = { ...req.headers, host: u.host };
      delete headers["content-length"]; // 改写后长度已变
      headers["content-length"] = String(body.length);
      const up = http.request(
        {
          hostname: u.hostname,
          port: u.port || 80,
          path: req.url,
          method: req.method,
          headers,
        },
        (ur) => {
          res.writeHead(ur.statusCode ?? 502, ur.headers);
          ur.pipe(res); // SSE 流式透传
        },
      );
      up.on("error", (e) => {
        if (!res.headersSent)
          res.writeHead(502, { "content-type": "text/plain" });
        res.end(`llm-proxy upstream error: ${e.message}`);
        log("llm-proxy", `上游错误： ${e.message}`);
      });
      up.end(body);
    });
  });

  server.listen(port, "127.0.0.1", () => {
    log(
      "llm-proxy",
      `监听 127.0.0.1:${port} → ${upstream}（developer→system）`,
    );
  });
}
