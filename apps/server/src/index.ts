import express from "express";
import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";
import { db, tasks } from "./db.js";
import { transcribeRouter } from "./routes/transcribe.js";
import { tasksRouter, verifyRouter, screenRouter } from "./routes/tasks.js";
import { adminRouter } from "./routes/admin.js";
import { log } from "./util/logger.js";

const app = express();
app.set("trust proxy", true); // Caddy 反代后取真实 IP
app.use(express.json({ limit: "64kb" }));

// 跨域放行：前端异地部署（如 EdgeOne Pages 连远程后端）时按 ALLOWED_ORIGINS 放行；留空 = 仅同源
if (config.allowOrigins.length) {
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && config.allowOrigins.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader(
        "Access-Control-Allow-Methods",
        "GET, POST, DELETE, OPTIONS",
      );
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization",
      );
      res.setHeader("Access-Control-Max-Age", "86400");
      if (req.method === "OPTIONS") {
        res.sendStatus(204);
        return;
      }
    }
    next();
  });
}

app.use("/api/transcribe", transcribeRouter);
app.use("/api/tasks", tasksRouter);
app.use("/api/verify", verifyRouter);
app.use("/api/screen", screenRouter);
app.use("/api/admin", adminRouter);

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    provider: config.generation.provider,
    whisper: config.whisper.provider,
  });
});

/** mock 发布产物预览 */
app.use(
  "/preview",
  express.static(path.join(config.dataDir, "published"), { fallthrough: true }),
);

/** 生产：托管 web 构建产物（SPA fallback 到 index.html,/verify 由前端路由处理） */
const webDist = path.resolve(import.meta.dirname, "../../web/dist");
if (fs.existsSync(webDist)) {
  app.use(express.static(webDist));
  app.get(/^\/(?!api|preview).*/, (_req, res) => {
    res.sendFile(path.join(webDist, "index.html"));
  });
}

// 启动恢复：上次运行中断的任务标记失败（admin 可重试）
{
  const interrupted = [
    ...(db.prepare("SELECT id FROM tasks WHERE status = 'queued'").all() as {
      id: string;
    }[]),
    ...(db
      .prepare(
        "SELECT id FROM tasks WHERE status IN ('generating','validating')",
      )
      .all() as { id: string }[]),
  ];
  for (const { id } of interrupted) {
    tasks.update({
      id,
      status: "failed",
      stage: "服务重启中断",
      error: "server restarted",
      finished_at: Date.now(),
    });
    log("boot", `任务 ${id} 标记为失败（服务重启）`);
  }
}

const server = app.listen(config.port, () => {
  log(
    "boot",
    `Words2Site server 启动 :${config.port}(生成：${config.generation.provider} / 转写：${config.whisper.provider})`,
  );
});

function shutdown() {
  log("boot", "收到退出信号，关闭服务…");
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
