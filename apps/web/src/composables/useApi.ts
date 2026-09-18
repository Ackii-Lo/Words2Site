import { apiUrl } from "@/lib/apiBase";

/** 轻量 API 封装：统一错误信息提取 */
export async function api<T = unknown>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(apiUrl(path), {
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    ...init,
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data?.error || `请求失败（${res.status}）`);
  return data;
}

export interface TaskStatus {
  status:
    | "queued"
    | "generating"
    | "validating"
    | "publishing"
    | "done"
    | "published"
    | "failed";
  stage: string | null;
  queuePosition: number;
  queueDepth: number;
  error: string | null;
  attempts: number;
  prompt: string;
  createdAt: number;
  publishUrl: string | null;
  code: string | null;
}
