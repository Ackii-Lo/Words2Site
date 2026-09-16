import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";
import { tasks } from "../db.js";
import { generate } from "./generator.js";
import { validateHtmlFile } from "./validator.js";
import { sessionManager } from "./codexSession.js";
import { taskLog, log } from "../util/logger.js";

type Job = { taskId: string; kind: "gen" | "refine"; instruction?: string };

/** FIFO(refine 优先插队：参与者正盯着屏幕等第二版) */
const pending: Job[] = [];
let activeCount = 0;

function workdirOf(taskId: string): string {
  return path.join(config.dataDir, "tasks", taskId, "work");
}

function artifactPath(taskId: string): string {
  return path.join(config.dataDir, "tasks", taskId, "index.html");
}

function dispatch() {
  while (activeCount < config.generation.maxConcurrent && pending.length > 0) {
    const job = pending.shift()!;
    activeCount++;
    runJob(job)
      .catch((err) => taskLog(job.taskId, `runJob 异常： ${err instanceof Error ? err.message : String(err)}`))
      .finally(() => {
        activeCount--;
        dispatch();
      });
  }
}

async function runJob(job: Job) {
  const { taskId } = job;
  const t = tasks.get(taskId);
  if (!t) return;
  const workdir = t.workdir ?? workdirOf(taskId);
  tasks.update({ id: taskId, workdir, status: "generating", stage: job.kind === "refine" ? "按修改意见调整中" : "AI 生成中" });

  if (job.kind === "gen" && !fs.existsSync(path.join(workdir, "prompt.txt"))) {
    fs.mkdirSync(workdir, { recursive: true });
    fs.writeFileSync(path.join(workdir, "prompt.txt"), t.prompt, "utf-8");
  }

  const tempSession = `pending-${taskId}-${Date.now()}`;
  sessionManager.register({
    sessionId: tempSession,
    taskId,
    pid: null,
    state: "spawning",
    workdir,
    startedAt: Date.now(),
  });

  const result = await generate({
    taskId,
    workdir,
    refine:
      job.kind === "refine" && t.codex_session_id && !t.codex_session_id.startsWith("mock-") && !t.codex_session_id.startsWith("pending-") && !t.codex_session_id.startsWith("local-")
        ? { instruction: job.instruction!, sessionId: t.codex_session_id }
        : job.kind === "refine"
          ? { instruction: job.instruction!, sessionId: "" } // mock/local：重新完整生成
          : undefined,
  });

  // 会话登记：用真实 sessionId 替换占位
  if (result.sessionId && result.sessionId !== tempSession) {
    sessionManager.remove(tempSession);
    sessionManager.register({
      sessionId: result.sessionId,
      taskId,
      pid: null,
      state: "generating",
      workdir,
      startedAt: Date.now(),
    });
  } else if (result.sessionId === tempSession) {
    sessionManager.remove(tempSession);
  }
  tasks.update({
    id: taskId,
    codex_session_id: result.sessionId ?? null,
    status: "validating",
    stage: "校验产物",
  });

  if (!result.ok || !result.htmlPath) {
    sessionManager.finish(result.sessionId ?? tempSession, "failed");
    await handleFailure(taskId, job, result.error ?? "未知错误");
    return;
  }

  const v = validateHtmlFile(result.htmlPath);
  if (!v.ok) {
    sessionManager.finish(result.sessionId ?? tempSession, "failed");
    taskLog(taskId, `校验失败： ${v.reason}`);
    await handleFailure(taskId, job, `产物校验失败： ${v.reason}`);
    return;
  }

  fs.copyFileSync(result.htmlPath, artifactPath(taskId));
  const size = fs.statSync(artifactPath(taskId)).size;
  sessionManager.finish(result.sessionId ?? tempSession, "done");
  tasks.update({
    id: taskId,
    status: "done",
    stage: "生成完成",
    html_size: size,
    refinements: job.kind === "refine" ? t.refinements + 1 : t.refinements,
    error: null,
  });
  taskLog(taskId, `完成（${job.kind}）,${(size / 1024).toFixed(1)}KB`);
}

async function handleFailure(taskId: string, job: Job, error: string) {
  const t = tasks.get(taskId)!;
  const attempts = (t.attempts ?? 0) + 1;
  if (attempts < 2) {
    taskLog(taskId, `第 ${attempts} 次失败，自动重试： ${error}`);
    tasks.update({ id: taskId, status: "queued", stage: "自动重试排队中", attempts, error });
    enqueue({ taskId, kind: job.kind, instruction: job.instruction });
  } else {
    tasks.update({
      id: taskId,
      status: "failed",
      stage: "失败",
      attempts,
      error,
      finished_at: Date.now(),
    });
    taskLog(taskId, `最终失败： ${error}`);
  }
}

export const queue = {
  enqueueGen(taskId: string) {
    enqueue({ taskId, kind: "gen" });
  },
  enqueueRefine(taskId: string, instruction: string) {
    enqueue({ taskId, kind: "refine", instruction });
  },
  positionOf(taskId: string): number {
    const idx = pending.findIndex((j) => j.taskId === taskId);
    return idx < 0 ? 0 : idx;
  },
  stats() {
    return { pending: pending.length, active: activeCount, slots: config.generation.maxConcurrent };
  },
};

function enqueue(job: Job) {
  if (job.kind === "refine") pending.unshift(job);
  else pending.push(job);
  log("queue", `入队 ${job.kind}:${job.taskId}，待处理 ${pending.length}`);
  dispatch();
}
