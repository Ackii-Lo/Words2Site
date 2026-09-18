import express from "express";
import fs from "node:fs";
import path from "node:path";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { config } from "./config.js";
import { db, tasks, reservations } from "./db.js";
import { tasksTable } from "./schema.js";
import { tasksRouter, verifyRouter, screenRouter } from "./routes/tasks.js";
import { adminRouter } from "./routes/admin.js";
import { queue } from "./services/queue.js";
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

app.use("/api/tasks", tasksRouter);
app.use("/api/verify", verifyRouter);
app.use("/api/screen", screenRouter);
app.use("/api/admin", adminRouter);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, provider: config.generation.provider });
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

// 启动恢复：
// 1) 存量 tasks 回填域名预约表（幂等）
reservations.backfill();

// 2) 上次运行中断的任务标记失败 + 释放预约（admin 可重试，重试时会重抢预约）
{
  const interrupted = db
    .select({ id: tasksTable.id })
    .from(tasksTable)
    .where(
      inArray(tasksTable.status, [
        "queued",
        "generating",
        "validating",
        "publishing",
      ]),
    )
    .all();
  for (const { id } of interrupted) {
    tasks.update({
      id,
      status: "failed",
      stage: "服务重启中断",
      error: "server restarted",
      finished_at: Date.now(),
    });
    reservations.releaseByTask(id);
    log("boot", `任务 ${id} 标记为失败（服务重启）`);
  }
}

// 3) done 存量（旧流程停在「生成完成待手动发布」）：产物在则补发
{
  const leftovers = db
    .select({ id: tasksTable.id })
    .from(tasksTable)
    .where(
      and(
        eq(tasksTable.status, "done"),
        isNotNull(tasksTable.html_size),
        // 已发布/已下线的不动（removed_at 判下线）
      ),
    )
    .all();
  for (const { id } of leftovers) {
    queue.enqueuePublish(id);
    log("boot", `任务 ${id} 为 done 存量，排队补发`);
  }
}

const server = app.listen(config.port, () => {
  log(
    "boot",
    `Words2Site server 启动 :${config.port}（生成：${config.generation.provider}）`,
  );
});

function shutdown() {
  log("boot", "收到退出信号，关闭服务…");
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
