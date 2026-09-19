<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import {
  centerDistance,
  register,
  release,
  unregister,
  want,
  type FrameSlot,
} from "@/lib/frameSlots";

/**
 * 懒加载 iframe：进入视口（含预载边距）才挂载内容。
 *
 * 2026-09-19 上线后实测（桌面大屏）：无截图的卡片全部走 iframe，
 * 27 个同时活着 → 内存与功耗失控；且「进入挂载 / 离开卸载」在滚动墙里
 * 反复抖动，卡片页面区一闪一闪。
 * 现在：全站最多 MAX_LIVE 个（见 lib/frameSlots.ts），优先给最靠近屏幕
 * 中心的卡片；离开预载区只标记不再需要、不立刻卸载，只有别处排队等不到
 * 槽位时才被回收（LRU），所以内容不会一闪一闪，回来也不重新加载。
 * 未拿到槽位的卡片显示静态占位，不来回挂载。
 *
 * 真实活动应优先给卡片配截图（服务端 puppeteer），本组件是兜底路径。
 */
defineProps<{
  src?: string;
  srcdoc?: string;
  title?: string;
}>();

const host = ref<HTMLElement | null>(null);
const live = ref(false);
let io: IntersectionObserver | null = null;
let slot: FrameSlot | null = null;

onMounted(() => {
  const el = host.value;
  if (!el) return;
  slot = {
    want: false,
    live: false,
    pri: () => centerDistance(el),
    set: (v: boolean) => (live.value = v),
  };
  register(slot);
  io = new IntersectionObserver(
    (entries) => {
      const hit = entries[entries.length - 1]?.isIntersecting ?? false;
      if (!slot) return;
      if (hit) want(slot);
      else release(slot);
    },
    // 提前后各半个视口预载，滚动到之前已就绪
    { rootMargin: "50% 50% 50% 50%", threshold: 0 },
  );
  io.observe(el);
});
onUnmounted(() => {
  io?.disconnect();
  if (slot) unregister(slot);
});
</script>

<template>
  <div ref="host" class="relative h-full w-full overflow-hidden bg-[#26231F]">
    <!-- 占位：图纸网格 + 角标，等待进入预载区或等待空闲槽位 -->
    <div
      v-if="!live"
      class="absolute inset-0 grid place-items-center bg-[linear-gradient(rgba(247,212,71,.05)_1px,transparent_1px),linear-gradient(90deg,rgba(247,212,71,.05)_1px,transparent_1px)] bg-[size:14px_14px]"
    >
      <span class="font-mono text-[10px] tracking-widest text-[#A8A29E]"
        >LOADING…</span
      >
    </div>
    <iframe
      v-if="live && (src || srcdoc)"
      :src="src"
      :srcdoc="srcdoc"
      sandbox="allow-scripts"
      scrolling="no"
      class="h-full w-full border-0"
      :title="title ?? ''"
      :style="srcdoc ? 'pointer-events: none;' : undefined"
    />
  </div>
</template>
