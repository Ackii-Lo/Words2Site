import path from "node:path";
import { config } from "../config.js";
import { tasks } from "../db.js";
import { publish } from "./publisher.js";
import { sendCompletionMail } from "./mailer.js";
import { captureScreenshot } from "./screenshot.js";
import { fullDomain } from "../util/domain.js";
import { newCertCode } from "../util/ids.js";
import { taskLog } from "../util/logger.js";

/**
 * 发布收尾：产物落网关 + 落库 published + 异步邮件/截图。
 * 从旧 POST /api/tasks/:id/publish 抽取，供队列自动发布与 admin 补发共用。
 * @returns true = 已发布（含幂等命中）；false = 发布失败（可重试）
 */
export async function finalizeTask(taskId: string): Promise<boolean> {
  const t = tasks.get(taskId);
  if (!t) return false;
  if (t.status === "published" && t.publish_url) return true; // 幂等

  const file = path.join(config.dataDir, "tasks", taskId, "index.html");
  const domain = t.domain ?? fullDomain(taskId);
  // publish 可能抛异常（产物文件缺失 / 网络栈错误），不捕获会把任务卡死在 publishing
  const result = await publish(taskId, file, domain).catch(
    (
      err,
    ): {
      ok: false;
      url?: undefined;
      error: string;
    } => ({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }),
  );
  if (!result.ok || !result.url) {
    taskLog(taskId, `发布失败： ${result.error ?? "未知错误"}`);
    return false;
  }
  const url = result.url;
  const code = t.code ?? newCertCode();
  tasks.update({
    id: taskId,
    status: "published",
    stage: "已发布",
    publish_url: url,
    code,
    finished_at: Date.now(),
  });
  taskLog(taskId, `发布成功 ${url}`);

  // 异步收尾：完成邮件 + 大屏截图（失败不影响发布结果）
  if (t.email) {
    void sendCompletionMail({
      taskId,
      to: t.email,
      code,
      domain,
      url,
      verifyUrl: `${config.publicBaseUrl}/verify/${code}`,
      prompt: t.prompt,
    });
  }
  if (url.startsWith("https://")) {
    void captureScreenshot(taskId, url);
  }
  return true;
}
