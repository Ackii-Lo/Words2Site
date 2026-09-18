import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";

/** taskId → 最近一次输出时间（内存态，进程重启即空） */
const lastOutputAt = new Map<string, number>();

function logPath(taskId: string): string {
  return path.join(config.dataDir, "logs", `${taskId}.session.log`);
}

/**
 * codex 会话原始 stdout 日志：追加写盘 + 刷新 lastOutputAt（卡点观测）。
 * 与 taskLog（结构化事件日志，<id>.log）分开存放，避免事件被 stdout 噪音淹没。
 */
export const sessionLog = {
  write(taskId: string, chunk: string) {
    lastOutputAt.set(taskId, Date.now());
    try {
      fs.appendFileSync(logPath(taskId), chunk);
    } catch {
      // 日志失败不阻断生成主流程
    }
  },
  lastOutputAt(taskId: string): number | null {
    return lastOutputAt.get(taskId) ?? null;
  },
  /** 读尾部 maxBytes（statSync+readSync，避免整文件进内存）；无文件返回空 */
  tail(
    taskId: string,
    maxBytes = 16 * 1024,
  ): { totalBytes: number; tail: string } {
    const file = logPath(taskId);
    if (!fs.existsSync(file)) return { totalBytes: 0, tail: "" };
    const size = fs.statSync(file).size;
    const len = Math.min(size, maxBytes);
    const buf = Buffer.alloc(len);
    const fd = fs.openSync(file, "r");
    try {
      fs.readSync(fd, buf, 0, len, Math.max(0, size - len));
    } finally {
      fs.closeSync(fd);
    }
    return { totalBytes: size, tail: buf.toString("utf-8") };
  },
};
