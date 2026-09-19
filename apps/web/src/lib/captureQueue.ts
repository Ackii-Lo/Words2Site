import { toPng } from "@/lib/vendor/html-to-image.js";
import { apiUrl } from "@/lib/apiBase";
import { api, type TaskStatus } from "@/composables/useApi";

/**
 * 截图守护（模块级单例，与界面步骤完全解耦）。
 *
 * 2026-09-20 电脑端改异步后，用户提交完就离开（sent 页点确认即重置），
 * 不再有任何「步骤」挂着任务——截图不能继续绑在 done 步组件上。
 * 这里改成：提交成功即 watchCapture(taskId)，本模块自己轮询任务状态，
 * published 后在隐藏 iframe 里渲染产物并截图上传；失败/超时静默放弃，
 * 大屏自动回退 iframe 预览，绝不影响主流程。
 *
 * 旧 ShotCapture.vue 的取景逻辑原样搬入（保真度结论见组件历史注释：
 * 必须截 <body>，420×760@2x，等字体与动画稳定）。
 *
 * 注意：单例必须放模块级——写在 <script setup> 顶层是每组件实例一份。
 */
const SHOT_W = 420;
const SHOT_H = 760;
const POLL_MS = 4000;
/** 守护寿命上限：生成队列极端拥堵时别让 kiosk 一直轮询 */
const MAX_LIFE_MS = 15 * 60_000;

const watching = new Set<string>();

/** 提交成功即调用；同任务重复调用自动去重 */
export function watchCapture(taskId: string): void {
  if (watching.has(taskId)) return;
  watching.add(taskId);
  void run(taskId);
}

async function run(taskId: string): Promise<void> {
  const deadline = Date.now() + MAX_LIFE_MS;
  while (Date.now() < deadline) {
    let st: TaskStatus;
    try {
      st = await api<TaskStatus>(`/api/tasks/${taskId}`);
    } catch {
      await sleep(POLL_MS); // 网络抖动：继续等
      continue;
    }
    if (st.status === "failed") return; // 终态失败，放弃
    if (st.status === "published") {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          if (await captureOnce(taskId)) {
            console.debug(`[w2s] 截图已上传：${taskId}`);
            return;
          }
        } catch (e) {
          console.debug("[w2s] 截图失败（大屏将回退 iframe 预览）", e);
        }
        await sleep(2500);
      }
      return; // 两次都不成：放弃，大屏走 iframe
    }
    await sleep(POLL_MS);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

let frame: HTMLIFrameElement | null = null;
function removeFrame() {
  frame?.remove();
  frame = null;
}

/** 单次快门：隐藏 iframe 取景 → 截 body → POST 上传 */
async function captureOnce(taskId: string): Promise<boolean> {
  const htmlRes = await fetch(apiUrl(`/api/tasks/${taskId}/html`));
  if (!htmlRes.ok) return false;
  const html = await htmlRes.text();
  if (!html) return false;

  const shotFrame = document.createElement("iframe");
  frame = shotFrame;
  shotFrame.setAttribute("aria-hidden", "true");
  shotFrame.setAttribute("tabindex", "-1");
  shotFrame.style.cssText =
    "position:fixed;top:0;left:0;border:0;opacity:0;pointer-events:none;z-index:-1";
  await new Promise<void>((resolve) => {
    shotFrame.addEventListener("load", () => resolve(), { once: true });
    shotFrame.srcdoc = html;
    document.body.appendChild(shotFrame);
  });

  const doc = shotFrame.contentDocument;
  if (!doc?.body) {
    removeFrame();
    return false;
  }
  const noScroll = doc.createElement("style");
  noScroll.textContent = "html{overflow:hidden!important}";
  doc.head.appendChild(noScroll);

  try {
    await doc.fonts.ready;
  } catch {
    /* 字体 API 不可用就跳过 */
  }
  await sleep(600);

  const dataUrl = await toPng(doc.body, {
    width: SHOT_W,
    height: SHOT_H,
    pixelRatio: 2,
    backgroundColor: "#ffffff",
  });
  removeFrame();

  const blob = await (await fetch(dataUrl)).blob();
  const res = await fetch(apiUrl(`/api/tasks/${taskId}/screenshot`), {
    method: "POST",
    headers: { "Content-Type": "image/png" },
    body: blob,
  });
  return res.ok;
}
