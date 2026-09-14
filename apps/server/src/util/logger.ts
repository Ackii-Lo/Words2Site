import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";

function ts(): string {
  return new Date().toISOString();
}

export function log(scope: string, msg: string): void {
  console.log(`[${ts()}] [${scope}] ${msg}`);
}

export function logError(scope: string, msg: string, err?: unknown): void {
  const detail = err instanceof Error ? `${err.message}` : err ? String(err) : "";
  console.error(`[${ts()}] [${scope}] ${msg} ${detail}`);
}

/** 任务日志:console + data/logs/<taskId>.log(现场排障) */
export function taskLog(taskId: string, msg: string): void {
  const line = `[${ts()}] ${msg}\n`;
  console.log(`[task:${taskId}] ${msg}`);
  try {
    fs.appendFileSync(path.join(config.dataDir, "logs", `${taskId}.log`), line);
  } catch {
    // 日志失败不阻断主流程
  }
}
