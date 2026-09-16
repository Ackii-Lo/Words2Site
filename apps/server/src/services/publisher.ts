import fs from "node:fs";
import AdmZip from "adm-zip";
import { config } from "../config.js";
import { taskLog } from "../util/logger.js";

export interface PublishResult {
  ok: boolean;
  url?: string;
  error?: string;
}

/**
 * 发布 = sslly-nginx 网关 DeployStatic:
 * 把单文件 HTML 打成 zip(base64)，连同参与者域名、固定 group(如 hf)POST 给网关，
 * 网关解包落盘 + 写 proxy.yaml 静态路由 + 受控 reload，页面即上线。
 * 删除走 DeleteStatic(admin 管理台触发)。
 * 未配置 SSLLY_API_BASE 时走本地 mock 发布（data/published/，本服务托管预览）。
 */
export async function publish(taskId: string, htmlPath: string, domain: string): Promise<PublishResult> {
  if (!config.deploy.apiBase) return mockPublish(taskId, htmlPath);
  try {
    const zip = new AdmZip();
    zip.addFile("index.html", fs.readFileSync(htmlPath));
    const distZip = zip.toBuffer().toString("base64");

    const res = await fetch(`${config.deploy.apiBase}/DeployStatic`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.deploy.token}`,
      },
      body: JSON.stringify({ domain, distZip, group: config.deploy.group }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      code?: number;
      message?: string;
      staticKey?: string;
      apply?: { applied?: boolean; error?: string };
    };
    if (!res.ok) {
      taskLog(taskId, `DeployStatic 返回 ${res.status}: ${data.message ?? ""}`);
      return { ok: false, error: `网关部署失败（${data.message || res.status}）` };
    }
    if (!data.apply?.applied) {
      const reason = data.apply?.error || "未知原因";
      taskLog(taskId, `DeployStatic reload 失败： ${reason}`);
      return { ok: false, error: `部署未生效： ${reason}` };
    }
    const url = `https://${domain}/`;
    taskLog(taskId, `已部署 ${domain}(staticKey=${data.staticKey},group=${config.deploy.group})`);
    return { ok: true, url };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    taskLog(taskId, `部署请求失败： ${msg}`);
    return { ok: false, error: `部署请求失败： ${msg}` };
  }
}

/** 删除部署（管理台下线） */
export async function unpublish(taskId: string, domain: string): Promise<PublishResult> {
  try {
    const res = await fetch(`${config.deploy.apiBase}/DeleteStatic`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.deploy.token}`,
      },
      body: JSON.stringify({ domain, group: config.deploy.group }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      message?: string;
      apply?: { applied?: boolean; error?: string };
    };
    if (!res.ok || !data.apply?.applied) {
      return { ok: false, error: `网关删除失败（${data.message || data.apply?.error || res.status}）` };
    }
    taskLog(taskId, `已删除部署 ${domain}`);
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `删除请求失败： ${msg}` };
  }
}

/** 本地 mock：存 data/published/<taskId>/index.html，由本服务静态托管预览 */
function mockPublish(taskId: string, htmlPath: string): PublishResult {
  const dir = `${config.dataDir}/published/${taskId}`;
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(htmlPath, `${dir}/index.html`);
  taskLog(taskId, `mock 发布 → /preview/${taskId}/index.html`);
  return { ok: true, url: `/preview/${taskId}/index.html` };
}
