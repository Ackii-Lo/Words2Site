import { spawn } from "node:child_process";
import { config } from "../config.js";
import { sessions } from "../db.js";
import { log, taskLog } from "../util/logger.js";

export interface LiveSession {
  sessionId: string;
  taskId: string | null;
  pid: number | null;
  state: "spawning" | "generating" | "done" | "killed" | "failed";
  workdir: string | null;
  startedAt: number;
}

/** 内存注册表：当前/最近的 codex 进程（DB 存历史，内存管活跃态） */
const live = new Map<string, LiveSession>();

export const sessionManager = {
  register(s: LiveSession) {
    live.set(s.sessionId, s);
    sessions.upsert({
      sessionId: s.sessionId,
      taskId: s.taskId,
      pid: s.pid,
      state: s.state,
      workdir: s.workdir,
    });
  },
  markGenerating(sessionId: string) {
    const s = live.get(sessionId);
    if (s) s.state = "generating";
    sessions.setState(sessionId, "generating");
  },
  finish(sessionId: string, state: "done" | "failed") {
    const s = live.get(sessionId);
    if (s) s.state = state;
    sessions.setState(sessionId, state, true);
  },
  /** 移除占位会话（pending-*，真实 session 就位后替换） */
  remove(sessionId: string) {
    live.delete(sessionId);
  },
  /** 强杀一个会话的进程组 */
  kill(sessionId: string): boolean {
    const s = live.get(sessionId);
    if (!s || !s.pid) return false;
    try {
      process.kill(-s.pid, "SIGKILL");
      s.state = "killed";
      sessions.setState(sessionId, "killed", true);
      log("session", `已 kill 会话 ${sessionId} (pid=${s.pid})`);
      return true;
    } catch {
      return false;
    }
  },
  list(): LiveSession[] {
    return [...live.values()].sort((a, b) => b.startedAt - a.startedAt);
  },
  activeCount(): number {
    return [...live.values()].filter(
      (s) => s.state === "spawning" || s.state === "generating",
    ).length;
  },
  /** 会话池占用快照（admin SessionBoard 用） */
  stats() {
    const all = this.list();
    const active = all.filter(
      (s) => s.state === "spawning" || s.state === "generating",
    );
    return {
      slots: config.generation.maxConcurrent,
      active: active.length,
      sessions: all.slice(0, 20),
    };
  },
};

/** 健康探活：codex exec "say ok"(60s 超时) */
export async function probeCodex(): Promise<{ ok: boolean; detail: string }> {
  if (config.generation.provider === "mock") {
    return { ok: true, detail: "mock 模式，无需探活" };
  }
  const g = config.generation;
  const args = ["exec", "--sandbox", g.sandbox, "--skip-git-repo-check"];
  const env = { ...process.env } as NodeJS.ProcessEnv;
  if (g.baseUrl && g.apiKey) {
    args.push(
      `-c`,
      `model_provider=${g.modelProvider}`,
      `-c`,
      `model_providers.${g.modelProvider}.name=${g.modelProvider}`,
      `-c`,
      `model_providers.${g.modelProvider}.base_url=${g.baseUrl}`,
      `-c`,
      `model_providers.${g.modelProvider}.env_key=W2S_CODEX_API_KEY`,
      `-c`,
      `model_providers.${g.modelProvider}.wire_api=${g.wireApi}`,
    );
    if (g.model) args.push(`-c`, `model=${g.model}`);
    env.W2S_CODEX_API_KEY = g.apiKey;
  }
  args.push("say ok");
  return new Promise((resolve) => {
    const child = spawn(g.codexBin, args, {
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    const timer = setTimeout(() => {
      try {
        if (child.pid) process.kill(child.pid, "SIGKILL");
      } catch {
        /* noop */
      }
      resolve({ ok: false, detail: "探活超时（60s）" });
    }, 60_000);
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({ ok: false, detail: `无法启动 codex: ${err.message}` });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      const ok = code === 0;
      taskLog(
        "probe",
        `探活 ${ok ? "通过" : `失败 code=${code}: ${out.slice(-200)}`}`,
      );
      resolve({ ok, detail: ok ? "ok" : out.slice(-300).replace(/\n/g, " ") });
    });
  });
}
