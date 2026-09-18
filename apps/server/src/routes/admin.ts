import {
  Router,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { config } from "../config.js";
import { tasks, sessions, reservations } from "../db.js";
import { queue } from "../services/queue.js";
import { sessionManager, probeCodex } from "../services/codexSession.js";
import { sessionLog } from "../services/sessionLog.js";
import { unpublish } from "../services/publisher.js";
import { stripAnsi } from "../util/ansi.js";

export const adminRouter = Router();

/** Basic Auth */
function auth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? "";
  const m = /^Basic (.+)$/.exec(header);
  if (!m) {
    res
      .set("WWW-Authenticate", 'Basic realm="words2site-admin"')
      .status(401)
      .send();
    return;
  }
  const [, pass] = Buffer.from(m[1], "base64").toString().split(":");
  if (pass !== config.adminPassword) {
    res.status(401).send();
    return;
  }
  next();
}
adminRouter.use(auth);

/** 总览：统计 + 队列 + 累计 token */
adminRouter.get("/overview", (_req, res) => {
  res.json({
    stats: tasks.stats(),
    queue: queue.stats(),
    tokens: sessions.sumTokens(),
  });
});

/** 任务列表 */
adminRouter.get("/tasks", (req, res) => {
  const pageNo = Math.max(1, Number(req.query.page) || 1);
  res.json({ tasks: tasks.page(pageNo) });
});

/** 重试失败任务：产物在 → 只补发；产物不在 → 重新生成（均先重抢域名预约） */
adminRouter.post("/tasks/:id/retry", (req, res) => {
  const t = tasks.get(req.params.id);
  if (!t) {
    res.status(404).json({ error: "任务不存在" });
    return;
  }
  if (t.status !== "failed") {
    res.status(409).json({ error: "仅失败任务可重试" });
    return;
  }
  // 失败时预约已释放；若期间被别的任务占走，重试会与它撞名
  if (t.domain && !reservations.tryReserve(t.domain, t.id)) {
    res
      .status(409)
      .json({ error: `域名 ${t.domain} 已被其他任务占用，无法重试` });
    return;
  }
  tasks.update({
    id: t.id,
    status: "queued",
    stage: t.html_size ? "人工补发排队中" : "人工重试排队中",
    error: null,
    attempts: 0,
  });
  if (t.html_size) queue.enqueuePublish(t.id);
  else queue.enqueueGen(t.id);
  res.json({ ok: true });
});

/** 跳过发布（标记人工处理，释放域名预约） */
adminRouter.post("/tasks/:id/skip", (req, res) => {
  const t = tasks.get(req.params.id);
  if (!t) {
    res.status(404).json({ error: "任务不存在" });
    return;
  }
  tasks.update({
    id: t.id,
    status: "published",
    stage: "人工处理（跳过发布）",
    finished_at: Date.now(),
  });
  if (t.domain) reservations.release(t.domain, t.id);
  res.json({ ok: true });
});

/** 下线：调网关 DeleteStatic 删部署 + 标记 removed + 释放预约(大屏消失，直接链接失效) */
adminRouter.post("/tasks/:id/delete", async (req, res) => {
  const t = tasks.get(req.params.id);
  if (!t) {
    res.status(404).json({ error: "任务不存在" });
    return;
  }
  if (t.removed_at) {
    res.json({ ok: true }); // 幂等
    return;
  }
  if (t.status === "published" && t.domain) {
    const r = await unpublish(t.id, t.domain);
    if (!r.ok) {
      res.status(502).json({ error: r.error });
      return;
    }
  }
  tasks.update({ id: t.id, removed_at: Date.now(), stage: "已下线" });
  if (t.domain) reservations.release(t.domain, t.id);
  res.json({ ok: true });
});

/** 会话池状态（SessionBoard） */
adminRouter.get("/sessions", (_req, res) => {
  res.json(sessionManager.stats());
});

/** 会话原始 stdout 尾部（剥 ANSI；?tail=N 限返回字节数，默认 16KB） */
adminRouter.get("/tasks/:id/session-log", (req, res) => {
  const maxBytes = Math.min(
    64 * 1024,
    Math.max(1024, Number(req.query.tail) || 16 * 1024),
  );
  const { totalBytes, tail } = sessionLog.tail(req.params.id, maxBytes);
  res.json({
    totalBytes,
    lastOutputAt: sessionLog.lastOutputAt(req.params.id),
    tail: stripAnsi(tail),
  });
});

/** 强杀会话 */
adminRouter.post("/sessions/:sid/kill", (req, res) => {
  const ok = sessionManager.kill(req.params.sid);
  res
    .status(ok ? 200 : 404)
    .json(ok ? { ok: true } : { error: "会话不存在或已退出" });
});

/** codex 健康探活 */
adminRouter.post("/probe", async (_req, res) => {
  res.json(await probeCodex());
});
