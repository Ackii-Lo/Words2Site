/** ANSI 转义序列（SGR 色码等）。用 fromCharCode 构造，避免源码里出现控制字符字面量 */
const ESC = String.fromCharCode(27);
const ANSI_RE = new RegExp(`${ESC}\\[[0-9;]*[a-zA-Z]`, "g");

/** 剥除 ANSI 转义序列（codex stdout 的 token 行带色码包裹） */
export function stripAnsi(s: string): string {
  return s.replace(ANSI_RE, "");
}
