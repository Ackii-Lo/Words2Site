import fs from "node:fs";

export interface ValidationResult {
  ok: boolean;
  reason?: string;
}

const MIN_SIZE = 512; // 0.5KB
const MAX_SIZE = 512 * 1024; // 500KB

/**
 * 校验生成产物是可发布的安全单文件 HTML:
 * 1. 存在且非空  2. 大小区间  3. 基本结构  4. 无外部资源引用  5. 无外链 script
 */
export function validateHtmlFile(filePath: string): ValidationResult {
  if (!fs.existsSync(filePath))
    return { ok: false, reason: "index.html 未生成" };
  const size = fs.statSync(filePath).size;
  if (size < MIN_SIZE)
    return { ok: false, reason: `文件过小（${size}B），疑似生成不完整` };
  if (size > MAX_SIZE)
    return {
      ok: false,
      reason: `文件超限（${(size / 1024).toFixed(0)}KB > 500KB）`,
    };

  const html = fs.readFileSync(filePath, "utf-8");
  const lower = html.toLowerCase();
  if (!lower.includes("<!doctype html") && !lower.includes("<html")) {
    return { ok: false, reason: "缺少 HTML 文档结构" };
  }
  if (!lower.includes("</html>"))
    return { ok: false, reason: "HTML 未闭合，疑似被截断" };
  if (!lower.includes("<head>") || !lower.includes("<body")) {
    return { ok: false, reason: "缺少 head/body 结构" };
  }

  // 外部资源引用：src= / href= 指向 http(s) 或协议相对
  const urlAttr = /(?:src|href)\s*=\s*["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = urlAttr.exec(html)) !== null) {
    const url = m[1].trim();
    if (/^(https?:)?\/\//i.test(url)) {
      return { ok: false, reason: `包含外部资源引用： ${url.slice(0, 80)}` };
    }
  }
  // 外链 script(内联 script 允许)
  if (/<script[^>]+src\s*=/i.test(html)) {
    return { ok: false, reason: "包含外链 <script src>" };
  }
  return { ok: true };
}
