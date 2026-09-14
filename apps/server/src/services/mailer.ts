import { EmailPoster } from "email-poster";
import { config } from "../config.js";
import { taskLog } from "../util/logger.js";

/**
 * 发布完成通知邮件(email-poster,webhook 网关)。
 * MAIL_WEBHOOK_URL 未配置时只记日志跳过 —— 不阻断发布主流程。
 */
let poster: EmailPoster | null = null;
function getPoster(): EmailPoster | null {
  if (poster) return poster;
  if (!config.mail.webhookUrl) return null;
  poster = new EmailPoster({
    postUrl: config.mail.webhookUrl,
    preset: config.mail.preset as "smtogo" | "generic" | "custom_example",
    fromAddress: config.mail.from || undefined, // 流程侧发件人固定,from 留空即可
    headers: config.mail.token ? { Authorization: `Bearer ${config.mail.token}` } : {},
  });
  return poster;
}

export async function sendCompletionMail(p: {
  taskId: string;
  to: string;
  code: string;
  domain: string;
  url: string;
  verifyUrl: string;
  prompt: string;
}): Promise<void> {
  const mail = getPoster();
  if (!mail) {
    taskLog(p.taskId, `邮件未配置(MAIL_WEBHOOK_URL 为空),跳过发送 → ${p.to}`);
    return;
  }
  const body = `
  <div style="max-width:560px;margin:0 auto;font-family:system-ui,-apple-system,'PingFang SC',sans-serif">
    <div style="background:linear-gradient(135deg,#7c3aed,#db2777);color:#fff;padding:28px 32px;border-radius:16px 16px 0 0">
      <h1 style="margin:0;font-size:22px">你的网页已上线</h1>
    </div>
    <div style="border:1px solid #e5e7eb;border-top:0;border-radius:0 0 16px 16px;padding:28px 32px">
      <p style="color:#6b7280;font-size:14px">你在「Words to Website」活动中描述的网页已经生成并发布:</p>
      <p style="font-size:13px;color:#374151;background:#f9fafb;border-radius:8px;padding:12px">"${p.prompt}"</p>
      <p style="margin:24px 0">
        <a href="${p.url}" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-size:15px">${p.domain}</a>
      </p>
      <p style="font-size:14px;color:#374151">你的集章凭证编号:<b style="font-size:18px;letter-spacing:2px;color:#7c3aed">${p.code}</b></p>
      <p style="font-size:13px;color:#6b7280">凭此编号在活动现场找工作人员核验盖章。核验页:<a href="${p.verifyUrl}" style="color:#7c3aed">${p.verifyUrl}</a></p>
      <hr style="border:0;border-top:1px solid #f3f4f6;margin:24px 0">
      <p style="font-size:12px;color:#9ca3af">Words to Website · Activity 3 · 本邮件由活动系统自动发送</p>
    </div>
  </div>`;
  try {
    const res = await mail.send({
      to: p.to,
      subject: `你的网页已上线 · ${p.code}`,
      body,
      type: "html",
    });
    taskLog(p.taskId, `完成邮件已发送 → ${p.to}(messageId=${res.messageId ?? "-"}, status=${res.status})`);
  } catch (err) {
    taskLog(p.taskId, `邮件发送失败(不影响发布): ${err instanceof Error ? err.message : String(err)}`);
  }
}
