import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";
import { tasks, reservations } from "../db.js";
import { generate } from "./generator.js";
import { validateHtmlFile, ensureAttribution } from "./validator.js";
import { sessionManager } from "./codexSession.js";
import { sessionLog } from "./sessionLog.js";
import { finalizeTask } from "./finalize.js";
import { taskLog, log } from "../util/logger.js";

type Job = { taskId: string; kind: "gen" | "publish" };

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
      .catch((err) =>
        taskLog(
          job.taskId,
          `runJob 异常： ${err instanceof Error ? err.message : String(err)}`,
        ),
      )
      .finally(() => {
        activeCount--;
        dispatch();
      });
  }
}

async function runJob(job: Job) {
  if (job.kind === "publish") {
    await runPublish(job.taskId);
    return;
  }
  await runGen(job.taskId);
}

/**
 * 发布重试：退避 10s × 3 次。失败不重跑生成（产物已就绪，重跑白烧 token），
 * 由调用方标 failed + 释放域名预约，admin 可走补发路径重试。
 */
async function finalizeWithRetry(taskId: string): Promise<boolean> {
  for (let i = 1; i <= 3; i++) {
    if (i > 1) await new Promise((r) => setTimeout(r, 10_000));
    if (await finalizeTask(taskId)) return true;
    taskLog(
      taskId,
      `发布第 ${i}/3 次失败${i < 3 ? "，10s 后重试" : "，停止重试"}`,
    );
  }
  return false;
}

/** 补发：产物在而未发布（admin retry 分流 / 重启恢复的 done 存量） */
async function runPublish(taskId: string) {
  const t = tasks.get(taskId);
  if (!t) return;
  if (t.status === "published" && t.publish_url) return; // 幂等
  tasks.update({
    id: taskId,
    status: "publishing",
    stage: "自动发布中",
    error: null,
  });
  taskLog(taskId, "补发开始（产物已就绪，跳过生成）");
  if (!(await finalizeWithRetry(taskId))) {
    await failFinal(taskId, "自动发布失败（重试 3 次未成功）");
  }
}

async function runGen(taskId: string) {
  const t = tasks.get(taskId);
  if (!t) return;
  const workdir = t.workdir ?? workdirOf(taskId);
  tasks.update({
    id: taskId,
    workdir,
    status: "generating",
    stage: "AI 生成中",
    error: null, // 重入生成，清掉上一轮错误
  });

  if (!fs.existsSync(path.join(workdir, "prompt.txt"))) {
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
    lastOutputAt: null,
    tokensUsed: null,
  });

  const result = await generate({
    taskId,
    workdir,
    // spawn 即回填 pid：占位会话阶段就能 kill 进程组（修 pid 恒 null 的旧 bug）
    onSpawn: (pid) => sessionManager.updatePid(tempSession, pid),
    onStdout: (chunk) => sessionLog.write(taskId, chunk),
  });

  // 会话登记：用真实 sessionId 替换占位，pid 从占位会话继承（spawn 后才拿得到）
  const livePid = sessionManager.get(tempSession)?.pid ?? null;
  if (result.sessionId && result.sessionId !== tempSession) {
    sessionManager.remove(tempSession);
    sessionManager.register({
      sessionId: result.sessionId,
      taskId,
      pid: livePid,
      state: "generating",
      workdir,
      startedAt: Date.now(),
      lastOutputAt: sessionLog.lastOutputAt(taskId),
      tokensUsed: result.tokensUsed ?? null,
    });
  } else if (result.sessionId === tempSession) {
    sessionManager.remove(tempSession);
  }
  const sid = result.sessionId ?? tempSession;
  // 结束回填：pid / token 消耗 / 最后输出时间（SessionBoard 与总览指标用）
  sessionManager.updateMeta(sid, {
    pid: result.pid ?? undefined,
    tokensUsed: result.tokensUsed,
    lastOutputAt: sessionLog.lastOutputAt(taskId) ?? undefined,
  });

  tasks.update({
    id: taskId,
    codex_session_id: result.sessionId ?? null,
    status: "validating",
    stage: "校验产物",
    error: null, // 生成已结束，清掉残留错误
  });

  if (!result.ok || !result.htmlPath) {
    sessionManager.finish(sid, "failed");
    await handleFailure(taskId, `生成失败： ${result.error ?? "未知错误"}`);
    return;
  }

  const v = validateHtmlFile(result.htmlPath);
  if (!v.ok) {
    sessionManager.finish(sid, "failed");
    taskLog(taskId, `校验失败： ${v.reason}`);
    await handleFailure(taskId, `产物校验失败： ${v.reason}`);
    return;
  }

  // 署名保障：整页无 "Presented via CPU by Words2Site" 则注入普通文档流页脚
  if (ensureAttribution(result.htmlPath)) {
    taskLog(taskId, "产物缺少署名，已注入兜底页脚");
  }

  fs.copyFileSync(result.htmlPath, artifactPath(taskId));
  const size = fs.statSync(artifactPath(taskId)).size;
  sessionManager.finish(sid, "done");
  tasks.update({
    id: taskId,
    status: "publishing",
    stage: "自动发布中",
    html_size: size,
    error: null,
  });
  taskLog(taskId, `生成完成，${(size / 1024).toFixed(1)}KB，进入自动发布`);

  if (!(await finalizeWithRetry(taskId))) {
    await failFinal(taskId, "自动发布失败（重试 3 次未成功）");
  }
}

/** 生成失败：attempts<2 自动重排（预约保留，域名仍归本任务）；否则终态失败并释放预约 */
async function handleFailure(taskId: string, error: string) {
  const t = tasks.get(taskId)!;
  const attempts = (t.attempts ?? 0) + 1;
  if (attempts < 2) {
    taskLog(taskId, `第 ${attempts} 次失败，自动重试： ${error}`);
    tasks.update({
      id: taskId,
      status: "queued",
      stage: "自动重试排队中",
      attempts,
      error,
    });
    enqueue({ taskId, kind: "gen" });
  } else {
    await failFinal(taskId, error);
  }
}

/** 终态失败：标 failed + 释放域名预约（域名可被再预约，admin retry 会重新抢） */
async function failFinal(taskId: string, error: string) {
  tasks.update({
    id: taskId,
    status: "failed",
    stage: "失败",
    error,
    finished_at: Date.now(),
  });
  reservations.releaseByTask(taskId);
  taskLog(taskId, `最终失败（域名预约已释放）： ${error}`);
}

export const queue = {
  enqueueGen(taskId: string) {
    enqueue({ taskId, kind: "gen" });
  },
  /** 产物在而未发布的补发（admin retry 分流 / 重启恢复的 done 存量） */
  enqueuePublish(taskId: string) {
    enqueue({ taskId, kind: "publish" });
  },
  positionOf(taskId: string): number {
    const idx = pending.findIndex((j) => j.taskId === taskId);
    return idx < 0 ? 0 : idx;
  },
  stats() {
    return {
      pending: pending.length,
      active: activeCount,
      slots: config.generation.maxConcurrent,
    };
  },
};

function enqueue(job: Job) {
  pending.push(job);
  log("queue", `入队 ${job.kind}:${job.taskId}，待处理 ${pending.length}`);
  dispatch();
}
