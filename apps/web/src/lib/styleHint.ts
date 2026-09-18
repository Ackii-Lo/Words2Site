/**
 * 大屏卡片外壳（七式之一）。后端用同一个字符串存到 tasks.style_hint，
 * 前端只读不判，按字符串分支渲染不同外壳。
 *
 * 注：分类词库**不要**放这里 —— 那是服务端的事。前端不需要 200 行关键词。
 * 服务端同名定义见 apps/server/src/services/styleHint.ts。
 */
export type CardStyle =
  | "archive" // 01 档案（米纸衬底＋黑标头）
  | "fullscreen" // 02 满幕（页面铺满＋黑信息条＋取景角标）
  | "spine" // 03 书脊（黑脊柱竖排域名）
  | "bigno" // 04 巨号（出血大序号＋黄框取景窗）
  | "collage" // 05 拼贴（斜贴米纸＋黄胶带）
  | "bubble" // 06 泡泡（大圆角＋黄虚线）
  | "classic"; // 07 典雅（细线双框＋衬线）

export const ALL_STYLES: CardStyle[] = [
  "archive",
  "fullscreen",
  "spine",
  "bigno",
  "collage",
  "bubble",
  "classic",
];

/** 缺省样式：未拿到 styleHint（旧记录 / 演示 fallback） */
export const DEFAULT_STYLE: CardStyle = "archive";

export function isCardStyle(v: unknown): v is CardStyle {
  return typeof v === "string" && (ALL_STYLES as string[]).includes(v);
}
