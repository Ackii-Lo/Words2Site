<script setup lang="ts">
import { onBeforeUnmount, onMounted } from "vue";
import { toPng } from "@/lib/vendor/html-to-image.js";
import { apiUrl } from "@/lib/apiBase";

/**
 * 无 UI 组件：发布完成后，在用户自己的浏览器里给产物页拍一张截图存进服务端。
 * 大屏轮询到 hasScreenshot=1 即走 <img>（GPU 解码 + 浏览器缓存，远比 iframe 便宜），
 * LOADING 占位和 iframe 兜底就基本从大屏上消失了。
 *
 * 为什么在浏览器拍而不是服务端 puppeteer：部署机要装 300MB Chromium 还要预热，
 * 活动现场多一个环节就多一个崩点；html-to-image 是 13KB 纯前端库（vendor 单文件，
 * 见 lib/vendor/），用户的浏览器就是相机，服务端只需一个收图端点。
 *
 * 保真度（2026-09-19 三类页面实测，平均色差 3–19/255）：必须截 <body>——
 * 截 documentElement 会丢背景渐变、内容缩在画布一角；已知损失是临界换行
 * 可能差一行（文字顶满行宽的页面才会碰到）。
 * 任何一步失败都静默放弃：大屏自动回退 iframe 预览，绝不影响主流程。
 */
const props = defineProps<{ taskId: string }>();

/** 与服务端 puppeteer 快门的既有约定一致：420×760@2x、非全页（顶部裁切） */
const SHOT_W = 420;
const SHOT_H = 760;

let stopped = false;
let frame: HTMLIFrameElement | null = null;

function removeFrame() {
  frame?.remove();
  frame = null;
}

async function captureOnce(): Promise<boolean> {
  // 1) 取产物 HTML，srcdoc 渲染（srcdoc 与父页同源，contentDocument 可读）
  const htmlRes = await fetch(apiUrl(`/api/tasks/${props.taskId}/html`));
  if (!htmlRes.ok) return false;
  const html = await htmlRes.text();
  if (!html || stopped) return false;

  // 2) 隐藏 iframe 等价于一个 420×760 的取景器；禁掉滚动条防布局被压窄 15px
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
  if (stopped) {
    removeFrame();
    return false;
  }

  const doc = frame.contentDocument;
  if (!doc?.body) {
    removeFrame();
    return false;
  }
  const noScroll = doc.createElement("style");
  noScroll.textContent = "html{overflow:hidden!important}";
  doc.head.appendChild(noScroll);

  // 3) 等字体与动画稳定（html-to-image 序列化的是当前 DOM 状态）
  try {
    await doc.fonts.ready;
  } catch {
    /* 字体 API 不可用就跳过 */
  }
  await new Promise((r) => setTimeout(r, 600));
  if (stopped) {
    removeFrame();
    return false;
  }

  // 4) 快门：截 <body>（不是 documentElement，见组件注释）
  const dataUrl = await toPng(doc.body, {
    width: SHOT_W,
    height: SHOT_H,
    pixelRatio: 2,
    backgroundColor: "#ffffff",
  });
  removeFrame();

  // 5) 交卷：PNG 原样 POST，服务端落盘 + 置 screenshot=1
  const blob = await (await fetch(dataUrl)).blob();
  const res = await fetch(apiUrl(`/api/tasks/${props.taskId}/screenshot`), {
    method: "POST",
    headers: { "Content-Type": "image/png" },
    body: blob,
  });
  return res.ok;
}

async function run() {
  for (let attempt = 0; attempt < 2 && !stopped; attempt++) {
    try {
      if (await captureOnce()) {
        console.debug(`[w2s] 截图已上传：${props.taskId}`);
        return;
      }
    } catch (e) {
      console.debug("[w2s] 截图失败（大屏将回退 iframe 预览）", e);
    }
    await new Promise((r) => setTimeout(r, 2500));
  }
}

onMounted(run);
onBeforeUnmount(() => {
  stopped = true;
  removeFrame();
});
</script>

<template>
  <!-- 纯后台组件：取景 iframe 挂在 body 上，这里不渲染任何可见内容 -->
  <i aria-hidden="true" style="display: none"></i>
</template>
