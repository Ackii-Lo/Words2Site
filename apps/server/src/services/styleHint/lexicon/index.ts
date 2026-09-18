import type { CardTheme } from "../styles.js";
import { TECH_WORDS } from "./tech.js";
import { DAILY_WORDS } from "./daily.js";
import { ARTS_WORDS } from "./arts.js";
import { CUTE_WORDS } from "./cute.js";

/** 四主题词库总装。词表就是纯数据，随时增删；调完建议跑一遍真实输入做回归。 */
export const LEXICON: Record<CardTheme, string[]> = {
  tech: TECH_WORDS,
  daily: DAILY_WORDS,
  arts: ARTS_WORDS,
  cute: CUTE_WORDS,
};
