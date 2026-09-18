import { Router, type Request, type Response } from "express";
import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";
import { tasks, reservations } from "../db.js";
import { allow } from "../services/ratelimit.js";
import { queue } from "../services/queue.js";
import { shotPath } from "../services/screenshot.js";
import { pickStyle } from "../services/styleHint.js";
import { fullDomain } from "../util/domain.js";
import { newTaskId, isValidDeviceId } from "../util/ids.js";

export const tasksRouter = Router();

/** 终态：done 仅存量兼容（旧库行 /:id/html 仍可访问） */
const TERMINAL = new Set(["done", "published", "failed"]);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DOMAIN_LABEL_RE = /^[a-z0-9][a-z0-9-]{2,30}$/;

function clientIp(req: Request): string {
  return req.ip ?? "unknown";
}

/** 创建生成任务（prompt + 邮箱 + 自定义域名 + 是否公开），队列走完自动发布 */
tasksRouter.post("/", (req: Request, res: Response) => {
  const { text, deviceId, email, domainLabel, isPublic } = (req.body ?? {}) as {
    text?: string;
    deviceId?: string;
    email?: string;
    domainLabel?: string;
    isPublic?: boolean;
  };
  const trimmed = (text ?? "").trim();
  if (trimmed.length < 10 || trimmed.length > config.maxTextLen) {
    res.status(400).json({
      error: `描述需要 10–${config.maxTextLen} 个字符（当前 ${trimmed.length}）`,
    });
    return;
  }
  const mail = (email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(mail) || mail.length > 100) {
    res.status(400).json({ error: "邮箱格式不正确" });
    return;
  }
  const label = (domainLabel ?? "").trim().toLowerCase();
  if (!DOMAIN_LABEL_RE.test(label)) {
    res.status(400).json({
      error: "域名只能用小写字母、数字和连字符，3–31 位，以字母或数字开头",
    });
    return;
  }
  const domain = fullDomain(label);
  const id = newTaskId();
  // 原子预约（PK 冲突即占用），消灭 check-then-insert 竞态
  if (!reservations.tryReserve(domain, id)) {
    res.status(409).json({ error: `「${label}」已被别人用了，换一个试试` });
    return;
  }
  const device = isValidDeviceId(deviceId) ? deviceId : "anon";
  const ip = clientIp(req);
  if (
    !allow(`g:${ip}`, config.rate.tasksPerHour) ||
    !allow(`d:${device}`, config.rate.tasksPerHour)
  ) {
    reservations.release(domain, id);
    res.status(429).json({ error: "生成次数已达上限，找工作人员帮忙吧" });
    return;
  }

  try {
    tasks.create({
      id,
      prompt: trimmed,
      ip,
      deviceId: device,
      email: mail,
      domain,
      isPublic: isPublic !== false,
      styleHint: pickStyle(trimmed),
    });
  } catch (e) {
    reservations.release(domain, id); // 落库失败回滚预约
    throw e;
  }
  queue.enqueueGen(id);
  res.json({ taskId: id, queuePosition: queue.positionOf(id), domain });
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
    prompt: t.prompt,
    createdAt: t.created_at,
    publishUrl: t.publish_url,
    code: t.code,
    domain: t.domain,
    email: t.email,
    isPublic: !!t.is_public,
    removed: !!t.removed_at,
  });
});

/** 大屏数据：已发布 + 公开 + 未下线的页面 */
export const screenRouter = Router();
screenRouter.get("/all", (_req: Request, res: Response) => {
  res.json(
    tasks.listScreen().map((t) => ({
      taskId: t.id,
      code: t.code,
      domain: t.domain,
      url: t.publish_url,
      prompt: t.prompt,
      hasScreenshot: !!t.screenshot,
      createdAt: t.created_at,
      styleHint: t.style_hint,
    })),
  );
});

/** 获取产物 HTML(iframe 预览；done 存量行保留兼容) */
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

/** 大屏截图（有则 PNG，无则 404，前端降级 iframe） */
tasksRouter.get("/:id/screenshot", (req: Request, res: Response) => {
  const file = shotPath(req.params.id);
  if (!fs.existsSync(file)) {
    res.status(404).send("no screenshot");
    return;
  }
  res.type("png").send(fs.readFileSync(file));
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

/** 凭证核验（扫码落地页取数，挂载于 /api/verify） */
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
    publishUrl: t.removed_at ? null : t.publish_url,
    domain: t.domain,
    status: t.removed_at ? "removed" : t.status,
    createdAt: t.created_at,
    finishedAt: t.finished_at,
  });
});
