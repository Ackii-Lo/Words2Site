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

/**
 * 点击卡片直达该任务发布出来的网页（publish_url，新标签页）。
 * 演示卡没有真实站点（域名是虚构的），不响应点击。
 */
export function openWallItem(item: WallItem): void {
  if (item.demoIndex === undefined && item.url)
    window.open(item.url, "_blank", "noopener");
}
