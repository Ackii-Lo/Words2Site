import fs from "node:fs";
import AdmZip from "adm-zip";
import { create, fromJson, toJsonString } from "@bufbuild/protobuf";
import type { JsonObject } from "@bufbuild/protobuf";
import { config } from "../config.js";
import { taskLog } from "../util/logger.js";
import {
  AuthenticateRequestSchema,
  AuthenticateResponseSchema,
} from "@buf/sslly-nginx_sslly-nginx.bufbuild_es/hnrobert/sslly/v1/auth_pb.js";
import {
  DeleteStaticRequestSchema,
  DeleteStaticResponseSchema,
  DeployStaticRequestSchema,
  DeployStaticResponseSchema,
} from "@buf/sslly-nginx_sslly-nginx.bufbuild_es/hnrobert/sslly/v1/deploy_pb.js";

export interface PublishResult {
  ok: boolean;
  url?: string;
  error?: string;
}

/**
 * 发布 = sslly-nginx 网关 DeployStatic：
 * 把单文件 HTML 打成 zip，连同参与者域名、固定 group(如 hf)POST 给网关，
 * 网关解包落盘 + 写 proxy.yaml 静态路由 + 受控 reload，页面即上线。
 * 删除走 DeleteStatic(admin 管理台触发)。
 * 认证是两步式：长效 token 只能调 Authenticate 换短期会话(默认 12h)，
 * 其余 RPC 一律携带会话 bearer；会话进程内缓存，过期前 60s 或遇 401 时重换。
 * 合同与消息类型来自 BSR 生成 SDK(buf.build/sslly-nginx/sslly-nginx，
 * protoc-gen-es codegenv2：消息为纯类型，经 Schema + create/toJsonString/fromJson 使用)，
 * typed fetch 打 JSON facade，未配置 SSLLY_API_BASE 时走本地 mock 发布。
 */

/** 会话缓存（进程内） */
let session: { token: string; expiresAt: number } | null = null;

/** 两步认证第一步：name + 长效 token → 短期会话 bearer */
async function getBearer(): Promise<string> {
  if (session && session.expiresAt > Date.now() / 1000 + 60)
    return session.token;
  const res = await fetch(`${config.deploy.apiBase}/Authenticate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: toJsonString(
      AuthenticateRequestSchema,
      create(AuthenticateRequestSchema, {
        name: config.deploy.user,
        token: config.deploy.token,
      }),
    ),
  });
  if (!res.ok) {
    const raw = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(`Authenticate 失败（${res.status}: ${raw.message ?? ""}）`);
  }
  const data = fromJson(AuthenticateResponseSchema, await res.json());
  session = { token: data.sessionToken, expiresAt: Number(data.expiresAt) };
  return session.token;
}

/** JSON facade 调用；401（会话被服务重启/吊销）时作废会话并重试一次 */
async function rpc(method: string, body: string): Promise<Response> {
  let res: Response;
  for (let attempt = 0; ; attempt++) {
    res = await fetch(`${config.deploy.apiBase}/${method}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${await getBearer()}`,
      },
      body,
    });
    if (res.status !== 401 || attempt >= 1) return res;
    session = null;
    taskLog("sslly", `会话失效（401），重新 Authenticate 后重试 ${method}`);
  }
}

/** 响应体统一按 JSON 解析：错误时抽 message，成功时交给生成类型反序列化 */
async function parseBody(
  res: Response,
): Promise<{ message: string; json: JsonObject }> {
  const json = (await res.json().catch(() => ({}))) as JsonObject;
  const message = typeof json.message === "string" ? json.message : "";
  return { message, json };
}

export async function publish(
  taskId: string,
  htmlPath: string,
  domain: string,
): Promise<PublishResult> {
  if (!config.deploy.apiBase) return mockPublish(taskId, htmlPath);
  try {
    const zip = new AdmZip();
    zip.addFile("index.html", fs.readFileSync(htmlPath));
    // distZip 直接给 Uint8Array，toJsonString 自动按 base64 编码进 JSON
    const body = toJsonString(
      DeployStaticRequestSchema,
      create(DeployStaticRequestSchema, {
        domain,
        distZip: zip.toBuffer(),
        group: config.deploy.group,
      }),
    );

    const res = await rpc("DeployStatic", body);
    const { message, json } = await parseBody(res);
    if (!res.ok) {
      taskLog(taskId, `DeployStatic 返回 ${res.status}: ${message}`);
      return { ok: false, error: `网关部署失败（${message || res.status}）` };
    }
    const data = fromJson(DeployStaticResponseSchema, json);
    if (!data.apply?.applied) {
      const reason = data.apply?.error || "未知原因";
      taskLog(taskId, `DeployStatic reload 失败： ${reason}`);
      return { ok: false, error: `部署未生效： ${reason}` };
    }
    const url = `https://${domain}/`;
    taskLog(
      taskId,
      `已部署 ${domain}(staticKey=${data.staticKey},group=${config.deploy.group})`,
    );
    return { ok: true, url };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    taskLog(taskId, `部署请求失败： ${msg}`);
    return { ok: false, error: `部署请求失败： ${msg}` };
  }
}

/** 删除部署（管理台下线） */
export async function unpublish(
  taskId: string,
  domain: string,
): Promise<PublishResult> {
  try {
    const body = toJsonString(
      DeleteStaticRequestSchema,
      create(DeleteStaticRequestSchema, { domain, group: config.deploy.group }),
    );
    const res = await rpc("DeleteStatic", body);
    const { message, json } = await parseBody(res);
    const data = fromJson(DeleteStaticResponseSchema, json);
    if (!res.ok || !data.apply?.applied) {
      return {
        ok: false,
        error: `网关删除失败（${message || data.apply?.error || res.status}）`,
      };
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
