import { EmailPoster } from "email-poster";
import { config } from "../config.js";
import { taskLog } from "../util/logger.js";

/**
 * 发布完成通知邮件（email-poster,webhook 网关）。
 * MAIL_WEBHOOK_URL 未配置时只记日志跳过 —— 不阻断发布主流程。
 */
let poster: EmailPoster | null = null;
function getPoster(): EmailPoster | null {
  if (poster) return poster;
  if (!config.mail.webhookUrl) return null;
  poster = new EmailPoster({
    postUrl: config.mail.webhookUrl,
    preset: config.mail.preset as "smtogo" | "generic" | "custom_example",
    fromAddress: config.mail.from || undefined, // 流程侧发件人固定，from 留空即可
    headers: config.mail.token
      ? { Authorization: `Bearer ${config.mail.token}` }
      : {},
  });
  return poster;
}

/**
 * 完成通知邮件内容（mailer 与 scripts/test-mail.ts 共用，避免模板漂移）。
 * lang 跟随用户表单里选择的「网页语言」（page_lang 列）。
 */
export function buildCompletionMail(p: {
  code: string;
  domain: string;
  url: string;
  verifyUrl: string;
  prompt: string;
  lang: "zh" | "en";
}): { subject: string; body: string } {
  const t = {
    zh: {
      subject: `你的网页已上线 · ${p.code}`,
      title: "你的网页已上线",
      intro: "你在「Words to Website」活动中描述的网页已经生成并发布：",
      codeLabel: "你的集章凭证编号：",
      verify: "凭此编号在活动现场找工作人员核验盖章。核验页：",
      footer: "本邮件由活动系统自动发送",
    },
    en: {
      subject: `Your page is live · ${p.code}`,
      title: "Your page is live",
      intro:
        "The page you described at the Words to Website event has been generated and published:",
      codeLabel: "Your stamp collection code:",
      verify:
        "Show this code to the event staff to get it stamped. Verify page: ",
      footer: "Sent automatically by the event system",
    },
  }[p.lang];
  // 站点同款视觉：纸张白卡 + 黄色描边（凭证卡语言）、黑底黄字编号章、
  // mono 字体编号、虚线引用块（对应页面虚线网格）——邮件客户端只认 inline style
  const body = `
  <div style="max-width:560px;margin:0 auto;font-family:system-ui,-apple-system,'PingFang SC',sans-serif;color:#1c1917">
    <div style="background:#fff;border:3px solid #f7d447;border-radius:8px;overflow:hidden">
      <div style="background:#1c1917;padding:22px 30px">
        <div style="font-family:Consolas,Menlo,monospace;font-size:11px;letter-spacing:3px;color:#f7d447">WORDS TO WEBSITE</div>
        <h1 style="margin:6px 0 0;font-size:21px;color:#fff;font-weight:700">${t.title}</h1>
      </div>
      <div style="padding:26px 30px">
        <p style="margin:0;font-size:14px;color:#78716c">${t.intro}</p>
        <p style="margin:14px 0;font-size:13px;color:#1c1917;background:#fafaf7;border:1px dashed #e7e5e0;border-radius:8px;padding:12px 14px">"${p.prompt}"</p>
        <p style="margin:24px 0">
          <a href="${p.url}" style="display:inline-block;background:#f7d447;color:#1c1917;text-decoration:none;font-weight:700;padding:12px 28px;border-radius:12px;font-size:15px">${p.domain}</a>
        </p>
        <p style="margin:0 0 6px;font-size:14px;color:#1c1917">${t.codeLabel}</p>
        <p style="margin:0 0 18px">
          <span style="display:inline-block;background:#1c1917;color:#f7d447;font-family:Consolas,Menlo,monospace;font-size:18px;letter-spacing:3px;padding:10px 18px;border-radius:8px">${p.code}</span>
        </p>
        <p style="margin:0;font-size:13px;color:#78716c">${t.verify}<a href="${p.verifyUrl}" style="color:#1c1917;font-weight:600">${p.verifyUrl}</a></p>
        <hr style="border:0;border-top:1px solid #e7e5e0;margin:24px 0">
        <p style="margin:0;font-family:Consolas,Menlo,monospace;font-size:11px;letter-spacing:1px;color:#78716c">Words to Website · Activity 3 · ${t.footer}</p>
      </div>
    </div>
  </div>`;
  return { subject: t.subject, body };
}

export async function sendCompletionMail(p: {
  taskId: string;
  to: string;
  code: string;
  domain: string;
  url: string;
  verifyUrl: string;
  prompt: string;
  lang: "zh" | "en";
}): Promise<void> {
  const mail = getPoster();
  if (!mail) {
    taskLog(
      p.taskId,
      `邮件未配置（MAIL_WEBHOOK_URL 为空），跳过发送 → ${p.to}`,
    );
    return;
  }
  const { subject, body } = buildCompletionMail(p);
  try {
    const res = await mail.send({
      to: p.to,
      subject,
      body,
      type: "html",
    });
    taskLog(
      p.taskId,
      `完成邮件已发送 → ${p.to}(messageId=${res.messageId ?? "-"}, status=${res.status})`,
    );
  } catch (err) {
    taskLog(
      p.taskId,
      `邮件发送失败（不影响发布）: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/**
 * 生成失败通知邮件（2026-09-20 电脑端改异步后补：用户提交即离开，
 * 失败时页面上明确的负反馈他看不到——必须靠邮件通知，否则石沉大海）。
 * 内容只说人话：出问题了、找工作人员重试；技术错误留给 taskLog/admin。
 */
export function buildFailureMail(p: {
  domainLabel: string;
  prompt: string;
  lang: "zh" | "en";
}): { subject: string; body: string } {
  const t = {
    zh: {
      subject: `你的网页这次没做出来 · ${p.domainLabel}`,
      bar: "生成遇到问题",
      title: "这次没做出来",
      intro: "你在「Words to Website」活动里描述的网页，生成时出了点问题：",
      outro: "别灰心——拿着这封邮件到活动现场找工作人员，可以马上重新做一次。",
      footer: "本邮件由活动系统自动发送",
    },
    en: {
      subject: `Your page didn't make it this time · ${p.domainLabel}`,
      bar: "GENERATION FAILED",
      title: "This one didn't make it",
      intro:
        "The page you described at the Words to Website event ran into a problem while being generated:",
      outro:
        "No worries — show this email to the event staff and they'll get you a retry right away.",
      footer: "Sent automatically by the event system",
    },
  }[p.lang];
  const body = `
  <div style="max-width:560px;margin:0 auto;font-family:system-ui,-apple-system,'PingFang SC',sans-serif;color:#1c1917">
    <div style="background:#fff;border:3px solid #f7d447;border-radius:8px;overflow:hidden">
      <div style="background:#1c1917;padding:22px 30px">
        <div style="font-family:Consolas,Menlo,monospace;font-size:11px;letter-spacing:3px;color:#f7d447">${t.bar}</div>
        <h1 style="margin:6px 0 0;font-size:21px;color:#fff;font-weight:700">${t.title}</h1>
      </div>
      <div style="padding:26px 30px">
        <p style="margin:0;font-size:14px;color:#78716c">${t.intro}</p>
        <p style="margin:14px 0;font-size:13px;color:#1c1917;background:#fafaf7;border:1px dashed #e7e5e0;border-radius:8px;padding:12px 14px">"${p.prompt}"</p>
        <p style="margin:24px 0 0;font-size:14px;color:#1c1917">${t.outro}</p>
        <hr style="border:0;border-top:1px solid #e7e5e0;margin:24px 0">
        <p style="margin:0;font-family:Consolas,Menlo,monospace;font-size:11px;letter-spacing:1px;color:#78716c">Words to Website · Activity 3 · ${t.footer}</p>
      </div>
    </div>
  </div>`;
  return { subject: t.subject, body };
}

export async function sendFailureMail(p: {
  taskId: string;
  to: string;
  domainLabel: string;
  prompt: string;
  lang: "zh" | "en";
}): Promise<void> {
  const mail = getPoster();
  if (!mail) {
    taskLog(
      p.taskId,
      `邮件未配置（MAIL_WEBHOOK_URL 为空），跳过失败通知 → ${p.to}`,
    );
    return;
  }
  const { subject, body } = buildFailureMail(p);
  try {
    const res = await mail.send({
      to: p.to,
      subject,
      body,
      type: "html",
    });
    taskLog(
      p.taskId,
      `失败通知邮件已发送 → ${p.to}(messageId=${res.messageId ?? "-"}, status=${res.status})`,
    );
  } catch (err) {
    taskLog(
      p.taskId,
      `失败通知邮件发送失败: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
