import { ref } from "vue";
import en, { waitingMessages as enMsgs } from "./en.js";
import zh, { waitingMessages as zhMsgs } from "./zh.js";

/**
 * 零依赖 i18n：模块级单例 locale（默认 EN，不写 storage——刷新即回英文）。
 * t() 在渲染期间读取 locale.value，模板里 {{ t("key") }} 随切换即时重渲染。
 * 两语言 key 对齐由 zh.ts 的 Record<keyof typeof en, string> 在编译期保证。
 */
export type Locale = "en" | "zh";
export type MessageKey = keyof typeof en;

export const locale = ref<Locale>("en");

const dicts: Record<Locale, Record<MessageKey, string>> = { en, zh };

export function setLocale(l: Locale): void {
  locale.value = l;
}

/** 取文案；vars 做 {x} 简单插值；未知 key 回退英文再回退 key 本身 */
export function t(
  key: MessageKey,
  vars?: Record<string, string | number>,
): string {
  let s = dicts[locale.value][key] ?? en[key] ?? (key as string);
  if (vars) {
    for (const [k, v] of Object.entries(vars))
      s = s.replaceAll(`{${k}}`, String(v));
  }
  return s;
}

/** 生成中轮换文案（数组，按语言取） */
export function waitingMessages(): readonly string[] {
  return locale.value === "zh" ? zhMsgs : enMsgs;
}

export function useI18n() {
  return { locale, setLocale, t, waitingMessages };
}
