import { Router, type Request, type Response, type NextFunction } from "express";
import { config } from "../config.js";
import { tasks } from "../db.js";
import { queue } from "../services/queue.js";
import { sessionManager, probeCodex } from "../services/codexSession.js";
import { unpublish } from "../services/publisher.js";

export const adminRouter = Router();

/** Basic Auth */
function auth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? "";
  const m = /^Basic (.+)$/.exec(header);
  if (!m) {
    res.set("WWW-Authenticate", 'Basic realm="words2site-admin"').status(401).send();
    return;
  }
  const [user, pass] = Buffer.from(m[1], "base64").toString().split(":");
  if (pass !== config.adminPassword) {
    res.status(401).send();
    return;
  }
  next();
}
adminRouter.use(auth);

/** 总览:统计 + 队列 */
adminRouter.get("/overview", (_req, res) => {
  res.json({ stats: tasks.stats(), queue: queue.stats() });
});

/** 任务列表 */
adminRouter.get("/tasks", (req, res) => {
  const pageNo = Math.max(1, Number(req.query.page) || 1);
  res.json({ tasks: tasks.page(pageNo) });
});

/** 重试失败任务 */
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
  tasks.update({ id: t.id, status: "queued", stage: "人工重试排队中", error: null, attempts: 0 });
  queue.enqueueGen(t.id);
  res.json({ ok: true });
});

/** 跳过发布(标记人工处理) */
adminRouter.post("/tasks/:id/skip", (req, res) => {
  const t = tasks.get(req.params.id);
  if (!t) {
    res.status(404).json({ error: "任务不存在" });
    return;
  }
  tasks.update({ id: t.id, status: "published", stage: "人工处理(跳过发布)", finished_at: Date.now() });
  res.json({ ok: true });
});

/** 下线:调网关 DeleteStatic 删部署 + 标记 removed(大屏消失,直接链接失效) */
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
  res.json({ ok: true });
});

/** 会话池状态(SessionBoard) */
adminRouter.get("/sessions", (_req, res) => {
  res.json(sessionManager.stats());
});

/** 强杀会话 */
adminRouter.post("/sessions/:sid/kill", (req, res) => {
  const ok = sessionManager.kill(req.params.sid);
  res.status(ok ? 200 : 404).json(ok ? { ok: true } : { error: "会话不存在或已退出" });
});

/** codex 健康探活 */
adminRouter.post("/probe", async (_req, res) => {
  res.json(await probeCodex());
});
