/** 主题（词库键）与大屏卡片外壳样式（七式）的类型与映射 */

export type CardTheme = "tech" | "daily" | "arts" | "cute";

export type CardStyle =
  | "archive" // 01 档案
  | "fullscreen" // 02 满幕
  | "spine" // 03 书脊
  | "bigno" // 04 巨号
  | "collage" // 05 拼贴
  | "bubble" // 06 泡泡
  | "classic"; // 07 典雅

export const ALL_STYLES: CardStyle[] = [
  "archive",
  "fullscreen",
  "spine",
  "bigno",
  "collage",
  "bubble",
  "classic",
];

/** 主题 → 样式池（同主题两种随机二选一） */
export const THEME_STYLES: Record<CardTheme, CardStyle[]> = {
  tech: ["fullscreen", "bigno"], // 02 / 04
  daily: ["archive", "collage"], // 01 / 05
  arts: ["spine", "classic"], // 03 / 07
  cute: ["bubble"], // 06
};
