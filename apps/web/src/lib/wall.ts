/** 大屏滚动墙的条目（真实任务或演示卡） */
export interface WallItem {
  taskId: string;
  code: string | null;
  domain: string | null;
  url: string | null;
  prompt: string;
  hasScreenshot: boolean;
  createdAt: number;
  demoIndex?: number; // 演示卡片：用 srcdoc
}
