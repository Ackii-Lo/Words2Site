/**
 * 主题分类器。
 *
 * 使用位置：后端创建 wall item 时调用一次 classifyTheme()，结果存 styleHint；
 * 前端只按 hint 渲染，不做判断。
 *
 * 规则：
 *  1. 整段用户输入对四个词库做匹配（中文子串匹配；纯英文词按词边界匹配、不区分大小写，
 *     避免 "ai" 误命中 "wait" 这类问题）。
 *  2. 命中关键词数最多的主题胜出（"我家猫猫的日常" → cute 2 票 > daily 1 票）。
 *  3. 并列 → 并列主题里随机一个（保持墙面多样性，不引入优先级偏见）。
 *  4. 零命中 → 返回 null，由调用方从七种样式随机（兜底）。
 */

import type { CardTheme, CardStyle } from "./styles.js";
import { ALL_STYLES, THEME_STYLES } from "./styles.js";
import { LEXICON } from "./lexicon/index.js";

const ASCII_ONLY = /^[\x21-\x7e]+$/;
const regexCache = new Map<string, RegExp | null>();

/** 纯英文/数字词 → 词边界正则（不区分大小写）；中文词 → null（走 includes） */
function toRegex(word: string): RegExp | null {
  if (!ASCII_ONLY.test(word)) return null;
  if (!regexCache.has(word)) {
    const body = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    regexCache.set(word, new RegExp(`(^|[^a-z0-9])${body}([^a-z0-9]|$)`, "i"));
  }
  return regexCache.get(word) ?? null;
}

function countHits(lowerText: string, words: string[]): number {
  let n = 0;
  for (const w of words) {
    const r = toRegex(w);
    if (r ? r.test(lowerText) : lowerText.includes(w)) n++;
  }
  return n;
}

const THEMES = Object.keys(LEXICON) as CardTheme[];

/** 命中最多关键词的主题胜出；并列随机；零命中返回 null（兜底随机样式） */
export function classifyTheme(text: string): CardTheme | null {
  const lower = text.toLowerCase();
  const scores = THEMES.map((t) => [t, countHits(lower, LEXICON[t])] as const);
  const max = Math.max(...scores.map(([, n]) => n));
  if (max === 0) return null;
  const tied = scores.filter(([, n]) => n === max).map(([t]) => t);
  if (tied.length === 1) return tied[0];
  return tied[Math.floor(Math.random() * tied.length)];
}

/** 调试用：返回各主题票数与胜出主题 */
export function classifyDetail(text: string): {
  scores: Record<CardTheme, number>;
  theme: CardTheme | null;
} {
  const lower = text.toLowerCase();
  const scores = Object.fromEntries(
    THEMES.map((t) => [t, countHits(lower, LEXICON[t])]),
  ) as Record<CardTheme, number>;
  const max = Math.max(...Object.values(scores));
  if (max === 0) return { scores, theme: null };
  const tied = THEMES.filter((t) => scores[t] === max);
  const theme =
    tied.length === 1 ? tied[0] : tied[Math.floor(Math.random() * tied.length)];
  return { scores, theme };
}

/** 一步到位：输入 → 样式 id（未命中 → 七种随机） */
export function pickStyle(text: string): CardStyle {
  const theme = classifyTheme(text);
  if (!theme) return ALL_STYLES[Math.floor(Math.random() * ALL_STYLES.length)];
  const pool = THEME_STYLES[theme];
  return pool[Math.floor(Math.random() * pool.length)];
}
