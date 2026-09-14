import { Router, type Request, type Response } from "express";
import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";
import { tasks } from "../db.js";
import { allow } from "../services/ratelimit.js";
import { queue } from "../services/queue.js";
import { publish } from "../services/publisher.js";
import { sendCompletionMail } from "../services/mailer.js";
import { captureScreenshot, shotPath } from "../services/screenshot.js";
import { newTaskId, newCertCode, isValidDeviceId } from "../util/ids.js";

export const tasksRouter = Router();

const TERMINAL = new Set(["done", "published", "failed"]);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DOMAIN_LABEL_RE = /^[a-z0-9][a-z0-9-]{2,30}$/;

function clientIp(req: Request): string {
  return req.ip ?? "unknown";
}

export function fullDomain(label: string): string {
  return config.deploy.domainTemplate.replace("{label}", label);
}

/** 创建生成任务(prompt + 邮箱 + 自定义域名 + 是否公开) */
tasksRouter.post("/", (req: Request, res: Response) => {
  const { text, deviceId, transcript, email, domainLabel, isPublic } = (req.body ?? {}) as {
    text?: string;
    deviceId?: string;
    transcript?: string;
    email?: string;
    domainLabel?: string;
    isPublic?: boolean;
  };
  const trimmed = (text ?? "").trim();
  if (trimmed.length < 10 || trimmed.length > config.maxTextLen) {
    res.status(400).json({
      error: `描述需要 10–${config.maxTextLen} 个字符(当前 ${trimmed.length})`,
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
    res.status(400).json({ error: "域名只能用小写字母、数字和连字符,3–31 位,以字母或数字开头" });
    return;
  }
  const domain = fullDomain(label);
  if (tasks.domainTaken(domain)) {
    res.status(409).json({ error: `「${label}」已被别人用了,换一个试试` });
    return;
  }
  const device = isValidDeviceId(deviceId) ? deviceId : "anon";
  const ip = clientIp(req);
  if (!allow(`g:${ip}`, config.rate.tasksPerHour) || !allow(`d:${device}`, config.rate.tasksPerHour)) {
    res.status(429).json({ error: "生成次数已达上限,找工作人员帮忙吧" });
    return;
  }

  const id = newTaskId();
  tasks.create({
    id,
    prompt: trimmed,
    transcript: transcript ?? null,
    ip,
    deviceId: device,
    email: mail,
    domain,
    isPublic: isPublic !== false,
  });
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
    refinements: t.refinements,
    maxRefine: config.generation.maxRefine,
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

/** 大屏数据:已发布 + 公开 + 未下线的页面 */
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
    })),
  );
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

/** 大屏截图(有则 PNG,无则 404,前端降级 iframe) */
tasksRouter.get("/:id/screenshot", (req: Request, res: Response) => {
  const file = shotPath(req.params.id);
  if (!fs.existsSync(file)) {
    res.status(404).send("no screenshot");
    return;
  }
  res.type("png").send(fs.readFileSync(file));
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
  const domain = t.domain ?? fullDomain(t.id);
  const result = await publish(t.id, file, domain);
  if (!result.ok || !result.url) {
    res.status(502).json({ error: `${result.error ?? "发布失败"},稍后重试或找工作人员` });
    return;
  }
  const url = result.url;
  const code = t.code ?? newCertCode();
  tasks.update({
    id: t.id,
    status: "published",
    stage: "已发布",
    publish_url: url,
    code,
    finished_at: Date.now(),
  });
  res.json({ publishUrl: url, code });

  // 异步收尾:完成邮件 + 大屏截图(失败不影响发布结果)
  if (t.email) {
    void sendCompletionMail({
      taskId: t.id,
      to: t.email,
      code,
      domain,
      url,
      verifyUrl: `${config.publicBaseUrl}/verify/${code}`,
      prompt: t.prompt,
    });
  }
  if (url.startsWith("https://")) {
    void captureScreenshot(t.id, url);
  }
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
    publishUrl: t.removed_at ? null : t.publish_url,
    domain: t.domain,
    status: t.removed_at ? "removed" : t.status,
    createdAt: t.created_at,
    finishedAt: t.finished_at,
  });
});
