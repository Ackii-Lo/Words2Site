import path from "node:path";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import dotenv from "dotenv";

// 环境变量来源：
// - dev:`tsx watch --env-file-if-exists=../../.env` 预加载仓库根 .env(tsx 会监听其变更并自动重启)
// - 生产（pm2/直接运行）：下面这行 dotenv 兜底加载
const rootEnv = path.resolve(import.meta.dirname, "../../../.env");
if (fs.existsSync(rootEnv)) dotenv.config({ path: rootEnv });
else dotenv.config();

function num(key: string, def: number): number {
  const v = process.env[key];
  if (!v) return def;
  const n = Number(v);
  if (Number.isNaN(n) || n <= 0)
    throw new Error(`环境变量 ${key} 不是合法正数： ${v}`);
  return n;
}

function str(key: string, def = ""): string {
  return process.env[key] ?? def;
}

function fail(msg: string): never {
  console.error(`[config] ${msg}`);
  process.exit(1);
}

const provider = str("GENERATION_PROVIDER", "mock");
if (provider !== "codex" && provider !== "mock") {
  fail(`GENERATION_PROVIDER 只能是 codex 或 mock，当前： ${provider}`);
}

if (provider === "codex") {
  // 提前暴露常见问题：codex 不存在
  const bin = str("CODEX_BIN", "codex");
  try {
    execFileSync("which", [bin], { stdio: "ignore" });
  } catch {
    fail(
      `CODEX_BIN=${bin} 不存在，请安装 codex 或改用 GENERATION_PROVIDER=mock`,
    );
  }
}

// codex wire 协议与沙箱档位（fail-fast 校验）
const wireApi = str("CODEX_WIRE_API", "responses");
if (wireApi !== "responses" && wireApi !== "chat") {
  fail(`CODEX_WIRE_API 只能是 responses 或 chat，当前： ${wireApi}`);
}
const sandbox = str("CODEX_SANDBOX", "workspace-write");
if (!["read-only", "workspace-write", "danger-full-access"].includes(sandbox)) {
  fail(
    `CODEX_SANDBOX 非法： ${sandbox}（read-only | workspace-write | danger-full-access）`,
  );
}

// DATA_DIR 相对路径一律相对仓库根解析（避免 tsx/dev/cwd 差异）；
// 空串视为未设置（?? 不会兜底空串，会把库和 .bak 落到仓库根）
const repoRoot = path.resolve(import.meta.dirname, "../../..");
const dataDir = path.resolve(repoRoot, process.env.DATA_DIR?.trim() || "data");
if (
  !process.env.DEPLOY_DOMAIN_TEMPLATE?.includes("{label}") &&
  process.env.DEPLOY_DOMAIN_TEMPLATE
) {
  fail("DEPLOY_DOMAIN_TEMPLATE 必须包含 {label} 占位符");
}
fs.mkdirSync(path.join(dataDir, "tasks"), { recursive: true });
fs.mkdirSync(path.join(dataDir, "logs"), { recursive: true });

export const config = {
  port: num("PORT", 3000),
  dataDir,
  publicBaseUrl: str("PUBLIC_BASE_URL", "http://localhost:5173").replace(
    /\/$/,
    "",
  ),

  generation: {
    provider: provider as "codex" | "mock",
    codexBin: str("CODEX_BIN", "codex"),
    baseUrl: str("CODEX_BASE_URL"),
    apiKey: str("CODEX_API_KEY"),
    modelProvider: str("CODEX_MODEL_PROVIDER", "w2s"),
    model: str("CODEX_MODEL"),
    maxConcurrent: num("MAX_CONCURRENT", 3),
    timeoutMs: num("GEN_TIMEOUT_MS", 240_000),
    // chat-only 端点（如智谱 Coding Plan）需 chat + codex CLI ≤0.92（更高版本已移除 chat）
    wireApi,
    sandbox,
  },

  /** 本地 LLM 反代（llmProxy.ts）：未配置不启动。CODEX_BASE_URL 指向 127.0.0.1:<port>/v1 */
  llmProxy: {
    upstream: str("LLM_PROXY_UPSTREAM").replace(/\/+$/, ""),
    port: num("LLM_PROXY_PORT", 3456),
  },

  publish: {
    endpoint: str("PUBLISH_ENDPOINT"),
    token: str("PUBLISH_TOKEN"),
    urlFlag: str("PUBLISH_URL_FLAG", "main"),
  },

  // sslly-nginx 网关静态部署（DeployService，两步认证）
  deploy: {
    apiBase: str(
      "SSLLY_API_BASE",
      "https://sslly-nas.hnrobert.space/api/v1",
    ).replace(/\/$/, ""),
    user: str("SSLLY_API_USER", "admin"),
    token: str("SSLLY_API_TOKEN", "admin"),
    group: str("DEPLOY_GROUP", "hf"),
    // 参与者域名模板，{label} 为参与者自定义部分；一级子域才能命中 *.hnrobert.space 通配证书
    domainTemplate: str("DEPLOY_DOMAIN_TEMPLATE", "w2s-{label}.hnrobert.space"),
    // 域名模板缺 {label} 时 fail-fast
  },

  mail: {
    webhookUrl: str("MAIL_WEBHOOK_URL"),
    from: str("MAIL_FROM", "noreply@words2site.local"),
    token: str("MAIL_TOKEN"),
    preset: str("MAIL_PRESET", "smtogo"),
  },

  adminPassword: str("ADMIN_PASSWORD", "change-me"),
  // 前端异地部署（如 EdgeOne Pages 连远程后端）时的跨域放行来源，逗号分隔；留空 = 仅同源
  allowOrigins: str("ALLOWED_ORIGINS")
    .split(",")
    .map((s) => s.trim().replace(/\/+$/, ""))
    .filter(Boolean),
  rate: {
    tasksPerHour: num("RATE_MAX_PER_HOUR", 3),
  },
  maxTextLen: num("MAX_TEXT_LEN", 300),
} as const;
