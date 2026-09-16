import path from "node:path";
import { config } from "../config.js";
import { tasks } from "../db.js";
import { taskLog } from "../util/logger.js";

/**
 * 大屏截图：发布成功后对线上 URL 截全页 PNG。
 * 运行时按需加载 puppeteer(可选依赖，未安装则大屏自动降级为 iframe 实时预览):
 *   pnpm --filter @words2site/server add puppeteer
 * 部署机首次运行会下载 Chromium，活动前务必预热。
 */

export function shotPath(taskId: string): string {
  return path.join(config.dataDir, "tasks", taskId, "shot.png");
}

export async function captureScreenshot(
  taskId: string,
  url: string,
): Promise<boolean> {
  let launch: (opts?: object) => Promise<{
    newPage: () => Promise<{
      setViewport: (o: object) => Promise<void>;
      goto: (u: string, o: object) => Promise<unknown>;
      screenshot: (o: object) => Promise<unknown>;
    }>;
    close: () => Promise<void>;
  }>;
  try {
    // 可选依赖：变量引入绕过 TS 静态解析，未安装时大屏自动降级 iframe
    const spec = "puppeteer";
    const mod = (await import(spec)) as unknown as {
      default: { launch: typeof launch };
    };
    launch = mod.default.launch;
  } catch {
    taskLog(taskId, "puppeteer 未安装，跳过截图（大屏将用 iframe 预览）");
    return false;
  }
  let browser: Awaited<ReturnType<typeof launch>> | null = null;
  try {
    browser = await launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
      ],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 420, height: 760, deviceScaleFactor: 2 });
    await page.goto(url, { waitUntil: "networkidle0", timeout: 30_000 });
    await new Promise((r) => setTimeout(r, 800)); // 等动画/字体稳定
    await page.screenshot({ path: shotPath(taskId), fullPage: false });
    tasks.update({ id: taskId, screenshot: 1 });
    taskLog(taskId, `截图完成 → ${url}`);
    return true;
  } catch (err) {
    taskLog(
      taskId,
      `截图失败（大屏将用 iframe 预览）: ${err instanceof Error ? err.message : String(err)}`,
    );
    return false;
  } finally {
    await browser?.close().catch(() => {});
  }
}
