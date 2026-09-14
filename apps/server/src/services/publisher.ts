import fs from "node:fs";
import { config } from "../config.js";
import { taskLog } from "../util/logger.js";

export interface PublishResult {
  ok: boolean;
  url?: string;
  error?: string;
}

/**
 * 发布产物的唯一接触点。活动方接口文档到手后只改本文件的 buildRequest/parseResponse。
 * 当前按约定:POST {PUBLISH_ENDPOINT} body { html, url: PUBLISH_URL_FLAG },Bearer 鉴权(可选)。
 * 未配置 PUBLISH_ENDPOINT 时走本地 mock 发布(data/published/,返回 file:// 不可用 → 返回相对预览路径)。
 */
export async function publish(taskId: string, htmlPath: string): Promise<PublishResult> {
  const html = fs.readFileSync(htmlPath, "utf-8");
  if (!config.publish.endpoint) return mockPublish(taskId, html);
  try {
    const res = await fetch(config.publish.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(config.publish.token ? { Authorization: `Bearer ${config.publish.token}` } : {}),
      },
      body: JSON.stringify({ html, url: config.publish.urlFlag }),
    });
    if (!res.ok) {
      const body = (await res.text()).slice(0, 300);
      taskLog(taskId, `发布接口返回 ${res.status}: ${body}`);
      return { ok: false, error: `发布接口返回 ${res.status}` };
    }
    const data = (await res.json().catch(() => ({}))) as { url?: string; link?: string; data?: { url?: string } };
    const url = data.url ?? data.link ?? data.data?.url;
    if (!url) {
      taskLog(taskId, `发布接口 200 但未返回 url: ${JSON.stringify(data).slice(0, 200)}`);
      return { ok: false, error: "发布接口未返回网址" };
    }
    return { ok: true, url };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    taskLog(taskId, `发布请求失败: ${msg}`);
    return { ok: false, error: `发布请求失败: ${msg}` };
  }
}

/** 本地 mock:存 data/published/<taskId>/index.html,由本服务静态托管预览 */
function mockPublish(taskId: string, html: string): PublishResult {
  const fsSync = fs;
  const dir = `${config.dataDir}/published/${taskId}`;
  fsSync.mkdirSync(dir, { recursive: true });
  fsSync.writeFileSync(`${dir}/index.html`, html);
  taskLog(taskId, `mock 发布 → /preview/${taskId}/index.html`);
  return { ok: true, url: `/preview/${taskId}/index.html` };
}
