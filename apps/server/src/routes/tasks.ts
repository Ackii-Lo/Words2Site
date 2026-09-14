import { Router, type Request, type Response } from "express";
import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";
import { tasks } from "../db.js";
import { allow } from "../services/ratelimit.js";
import { queue } from "../services/queue.js";
import { publish } from "../services/publisher.js";
import { newTaskId, newCertCode, isValidDeviceId } from "../util/ids.js";

export const tasksRouter = Router();

const TERMINAL = new Set(["done", "published", "failed"]);

function clientIp(req: Request): string {
  return req.ip ?? "unknown";
}

/** 创建生成任务 */
tasksRouter.post("/", (req: Request, res: Response) => {
  const { text, deviceId, transcript } = (req.body ?? {}) as {
    text?: string;
    deviceId?: string;
    transcript?: string;
  };
  const trimmed = (text ?? "").trim();
  if (trimmed.length < 10 || trimmed.length > config.maxTextLen) {
    res.status(400).json({
      error: `描述需要 10–${config.maxTextLen} 个字符(当前 ${trimmed.length})`,
    });
    return;
  }
  const device = isValidDeviceId(deviceId) ? deviceId : "anon";
  const ip = clientIp(req);
  if (!allow(`g:${ip}`, config.rate.tasksPerHour) || !allow(`d:${device}`, config.rate.tasksPerHour)) {
    res.status(429).json({ error: "生成次数已达上限,找工作人员帮忙吧" });
    return;
  }

  const id = newTaskId();
  tasks.create({ id, prompt: trimmed, transcript: transcript ?? null, ip, deviceId: device });
  queue.enqueueGen(id);
  res.json({ taskId: id, queuePosition: queue.positionOf(id) });
});

/** 轮询状态 */
tasksRouter.get("/:id", (req: Request, res: Response) => {
  const t = tasks.get(req.params.id);
  if (!t) {
    res.status(404).json({ error: "任务不存在" });
    return;
  }
  res.json({
    status: t.status,
    stage: t.stage,
    queuePosition: t.status === "queued" ? queue.positionOf(t.id) : 0,
    queueDepth: queue.stats().pending,
    error: t.error,
    attempts: t.attempts,
    refinements: t.refinements,
    maxRefine: config.generation.maxRefine,
    prompt: t.prompt,
    createdAt: t.created_at,
    publishUrl: t.publish_url,
    code: t.code,
  });
});

/** 获取产物 HTML(iframe 预览) */
tasksRouter.get("/:id/html", (req: Request, res: Response) => {
  const t = tasks.get(req.params.id);
  if (!t || !TERMINAL.has(t.status) || !t.html_size) {
    res.status(404).send("not ready");
    return;
  }
  const file = path.join(config.dataDir, "tasks", t.id, "index.html");
  if (!fs.existsSync(file)) {
    res.status(404).send("artifact missing");
    return;
  }
  res.type("html").send(fs.readFileSync(file, "utf-8"));
});

/** refine:按修改意见改写(resume codex 会话) */
tasksRouter.post("/:id/refine", (req: Request, res: Response) => {
  const t = tasks.get(req.params.id);
  if (!t) {
    res.status(404).json({ error: "任务不存在" });
    return;
  }
  if (t.status !== "done") {
    res.status(409).json({ error: "当前状态不能修改(仅生成完成可修改)" });
    return;
  }
  if (t.refinements >= config.generation.maxRefine) {
    res.status(429).json({ error: "修改次数已用完,直接发布或重新生成吧" });
    return;
  }
  const instruction = ((req.body?.text as string) ?? "").trim();
  if (instruction.length < 2 || instruction.length > 200) {
    res.status(400).json({ error: "修改意见需要 2–200 个字符" });
    return;
  }
  tasks.update({ id: t.id, status: "queued", stage: "修改意见排队中", error: null });
  queue.enqueueRefine(t.id, instruction);
  res.json({ ok: true, refinements: t.refinements + 1 });
});

/** 发布 */
tasksRouter.post("/:id/publish", async (req: Request, res: Response) => {
  const t = tasks.get(req.params.id);
  if (!t) {
    res.status(404).json({ error: "任务不存在" });
    return;
  }
  if (t.status === "published" && t.publish_url) {
    res.json({ publishUrl: t.publish_url, code: t.code }); // 幂等
    return;
  }
  if (t.status !== "done") {
    res.status(409).json({ error: "页面还没生成完成" });
    return;
  }
  const file = path.join(config.dataDir, "tasks", t.id, "index.html");
  const result = await publish(t.id, file);
  if (!result.ok) {
    res.status(502).json({ error: `${result.error},稍后重试或找工作人员` });
    return;
  }
  const code = t.code ?? newCertCode();
  tasks.update({
    id: t.id,
    status: "published",
    stage: "已发布",
    publish_url: result.url,
    code,
    finished_at: Date.now(),
  });
  res.json({ publishUrl: result.url, code });
});

/** 凭证数据 */
tasksRouter.get("/:id/certificate", (req: Request, res: Response) => {
  const t = tasks.get(req.params.id);
  if (!t || t.status !== "published" || !t.code) {
    res.status(404).json({ error: "凭证不存在" });
    return;
  }
  res.json({
    code: t.code,
    publishUrl: t.publish_url,
    verifyUrl: `${config.publicBaseUrl}/verify/${t.code}`,
    createdAt: t.created_at,
    prompt: t.prompt,
  });
});

/** 凭证核验(扫码落地页取数,挂载于 /api/verify) */
export const verifyRouter = Router();
verifyRouter.get("/:code", (req: Request, res: Response) => {
  const t = tasks.getByCode(req.params.code);
  if (!t) {
    res.status(404).json({ error: "凭证无效" });
    return;
  }
  res.json({
    code: t.code,
    prompt: t.prompt,
    publishUrl: t.publish_url,
    status: t.status,
    createdAt: t.created_at,
    finishedAt: t.finished_at,
  });
});
