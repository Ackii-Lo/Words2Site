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
      // 仅对 chat 请求改写 role（其他路径/非 JSON 原样透传）
      if (req.url?.includes("/chat/completions")) {
        try {
          const json = JSON.parse(body.toString("utf-8")) as {
            messages?: Array<{ role: string }>;
          };
          if (Array.isArray(json.messages)) {
            let n = 0;
            for (const m of json.messages)
              if (m && m.role === "developer") {
                m.role = "system";
                n++;
              }
            if (n > 0) body = Buffer.from(JSON.stringify(json), "utf-8");
          }
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
