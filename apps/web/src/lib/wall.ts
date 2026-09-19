import type { CardStyle } from "./styleHint";

/** 大屏滚动墙的条目（真实任务或演示卡） */
export interface WallItem {
  taskId: string;
  code: string | null;
  domain: string | null;
  url: string | null;
  prompt: string;
  hasScreenshot: boolean;
  createdAt: number;
  demoIndex?: number; // 演示卡片：内置 SVG 截图，走 img 路径
  /** 大屏卡片外壳（七式之一）。未传 → FilmCard 走 archive 默认。 */
  styleHint?: CardStyle | null;
}
