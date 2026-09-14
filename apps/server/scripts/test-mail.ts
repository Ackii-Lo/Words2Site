/**
 * 邮件链路测试:用 .env 中的 MAIL_WEBHOOK_URL(email-poster)向指定地址发一封
 * 与线上完全同款结构的完成通知邮件。
 * 用法:MAIL_TEST_TO=a@x.com,b@x.com pnpm --filter @words2site/server test:mail
 */
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { EmailPoster } from "email-poster";

const rootEnv = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../.env");
const dotenv = await import("dotenv");
if (fs.existsSync(rootEnv)) dotenv.config({ path: rootEnv });

const url = process.env.MAIL_WEBHOOK_URL;
if (!url) {
  console.error("MAIL_WEBHOOK_URL 未配置");
  process.exit(1);
}
const to = (process.env.MAIL_TEST_TO ?? "").split(",").map((s) => s.trim()).filter(Boolean);
if (to.length === 0) {
  console.error("MAIL_TEST_TO 未配置(逗号分隔收件人)");
  process.exit(1);
}

// 与 services/mailer.ts 相同的构造方式
const mail = new EmailPoster({
  postUrl: url,
  preset: (process.env.MAIL_PRESET ?? "smtogo") as "smtogo",
  fromAddress: process.env.MAIL_FROM || undefined,
  headers: process.env.MAIL_TOKEN ? { Authorization: `Bearer ${process.env.MAIL_TOKEN}` } : {},
});

const body = `
  <div style="max-width:560px;margin:0 auto;font-family:system-ui,-apple-system,'PingFang SC',sans-serif">
    <div style="background:linear-gradient(135deg,#7c3aed,#db2777);color:#fff;padding:28px 32px;border-radius:16px 16px 0 0">
      <h1 style="margin:0;font-size:22px">你的网页已上线</h1>
    </div>
    <div style="border:1px solid #e5e7eb;border-top:0;border-radius:0 0 16px 16px;padding:28px 32px">
      <p style="color:#6b7280;font-size:14px">你在「Words to Website」活动中描述的网页已经生成并发布:</p>
      <p style="font-size:13px;color:#374151;background:#f9fafb;border-radius:8px;padding:12px">"做一个介绍校园音乐社团的网页,青春活力风格,展示社团活动和招新信息"</p>
      <p style="margin:24px 0">
        <a href="https://w2s-e2e-demo.hnrobert.space/" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-size:15px">w2s-e2e-demo.hnrobert.space</a>
      </p>
      <p style="font-size:14px;color:#374151">你的集章凭证编号:<b style="font-size:18px;letter-spacing:2px;color:#7c3aed">W2S-HCKP</b></p>
      <p style="font-size:13px;color:#6b7280">凭此编号在活动现场找工作人员核验盖章。</p>
      <hr style="border:0;border-top:1px solid #f3f4f6;margin:24px 0">
      <p style="font-size:12px;color:#9ca3af">Words to Website · Activity 3 · 本邮件由活动系统自动发送(测试)</p>
    </div>
  </div>`;

for (const addr of to) {
  try {
    const res = await mail.send({
      to: addr,
      subject: `你的网页已上线 · W2S-HCKP(链路测试)`,
      body,
      type: "html",
    });
    console.log(`✓ ${addr} → status=${res.status} messageId=${res.messageId ?? "-"}`);
  } catch (e) {
    console.error(`✗ ${addr} → ${e instanceof Error ? e.message : String(e)}`);
    process.exitCode = 1;
  }
}
