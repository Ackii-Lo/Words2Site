/**
 * 邮件链路测试：用 .env 中的 MAIL_WEBHOOK_URL（email-poster）向指定地址发一封
 * 与线上完全同款结构的完成通知邮件。
 * 用法：MAIL_TEST_TO=a@x.com,b@x.com pnpm --filter @words2site/server test:mail
 */
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { EmailPoster } from "email-poster";
import { buildCompletionMail } from "../src/services/mailer.js";

const rootEnv = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../.env",
);
const dotenv = await import("dotenv");
if (fs.existsSync(rootEnv)) dotenv.config({ path: rootEnv });

const url = process.env.MAIL_WEBHOOK_URL;
if (!url) {
  console.error("MAIL_WEBHOOK_URL 未配置");
  process.exit(1);
}
const to = (process.env.MAIL_TEST_TO ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
if (to.length === 0) {
  console.error("MAIL_TEST_TO 未配置（逗号分隔收件人）");
  process.exit(1);
}

const mail = new EmailPoster({
  postUrl: url,
  preset: (process.env.MAIL_PRESET ?? "smtogo") as "smtogo",
  fromAddress: process.env.MAIL_FROM || undefined,
  headers: process.env.MAIL_TOKEN
    ? { Authorization: `Bearer ${process.env.MAIL_TOKEN}` }
    : {},
});

// 与线上同款模板（共享构造函数，样式改动只需改 services/mailer.ts）
// MAIL_TEST_LANG=en 可切英文版预览
const { subject: mailSubject, body } = buildCompletionMail({
  code: "W2S-HCKP",
  domain: "w2s-e2e-demo.hnrobert.space",
  url: "https://w2s-e2e-demo.hnrobert.space/",
  verifyUrl: "https://words2site.unnc.space/verify/W2S-HCKP",
  prompt: "做一个介绍校园音乐社团的网页，青春活力风格，展示社团活动和招新信息",
  lang: process.env.MAIL_TEST_LANG === "en" ? "en" : "zh",
});

for (const addr of to) {
  try {
    const res = await mail.send({
      to: addr,
      subject: `${mailSubject}(链路测试)`,
      body,
      type: "html",
    });
    console.log(
      `✓ ${addr} → status=${res.status} messageId=${res.messageId ?? "-"}`,
    );
  } catch (e) {
    console.error(`✗ ${addr} → ${e instanceof Error ? e.message : String(e)}`);
    process.exitCode = 1;
  }
}
