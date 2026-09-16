import crypto from "node:crypto";

const ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789"; // 去掉易混淆字符

/** 短任务 ID */
export function newTaskId(len = 10): string {
  const bytes = crypto.randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

/** 凭证编号 W2S-XXXX(Base32 风格，去混淆) */
export function newCertCode(): string {
  const bytes = crypto.randomBytes(4);
  let out = "";
  for (let i = 0; i < 4; i++) out += ALPHABET[bytes[i] % ALPHABET.length].toUpperCase();
  return `W2S-${out}`;
}

/** 前端 deviceId 透传校验 */
export function isValidDeviceId(v: unknown): v is string {
  return typeof v === "string" && /^[a-zA-Z0-9-_]{8,64}$/.test(v);
}
