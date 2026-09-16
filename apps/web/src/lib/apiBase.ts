/**
 * 后端基础地址：留空 = 同源（开发走 Vite 代理，生产由 Express 同域托管）。
 * 前端异地部署（如 EdgeOne Pages 连远程后端）时在仓库根 .env 设
 * VITE_API_BASE=https://<后端域名>，构建期注入。
 */
export const API_BASE = (import.meta.env.VITE_API_BASE ?? "").replace(
  /\/+$/,
  "",
);

/** 同源相对路径（/api/…）拼上后端基础地址 */
export const apiUrl = (path: string) => API_BASE + path;
