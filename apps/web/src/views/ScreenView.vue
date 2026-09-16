<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed } from "vue";
import { api } from "@/composables/useApi";
import LazyFrame from "@/components/LazyFrame.vue";
import { demoPage, demoItems } from "@/lib/demoPages";

interface WallItem {
  taskId: string;
  code: string | null;
  domain: string | null;
  url: string | null;
  prompt: string;
  hasScreenshot: boolean;
  createdAt: number;
  demoIndex?: number; // 演示卡片：用 srcdoc
}

const items = ref<WallItem[]>([]);
const demoCount = Number(new URLSearchParams(location.search).get("demo") ?? 0);
let pollTimer: ReturnType<typeof setInterval> | null = null;

async function refresh() {
  let real: WallItem[] = [];
  try {
    real = await api<WallItem[]>("/api/screen/all");
  } catch {
    /* 后端不可达：演示模式下仍可独立展示，真实模式留给空态 */
  }
  items.value = demoCount > 0 ? [...real, ...demoItems(demoCount)] : real;
}
onMounted(() => {
  void refresh();
  pollTimer = setInterval(refresh, 15_000);
});
onUnmounted(() => pollTimer && clearInterval(pollTimer));

/** 分轨：卡片轮流进轨，每轨独立滚动；内容复制一份衔接首尾实现无缝循环 */
const TRACKS = 3;
const tracks = computed(() => {
  const t: WallItem[][] = Array.from({ length: TRACKS }, () => []);
  items.value.forEach((it, i) => t[i % TRACKS].push(it));
  return t.filter((x) => x.length > 0);
});
const loop = (track: WallItem[]) => [...track, ...track];
const duration = (track: WallItem[]) => Math.max(40, track.length * 22);
</script>

<template>
  <div class="fixed inset-0 flex flex-col overflow-hidden bg-[#0E3A5D] text-[#EAF4FA]">
    <!-- 图签（title block）-->
    <header class="relative z-10 flex items-stretch justify-between border-b border-[rgba(214,236,248,.25)] bg-[#0B2E4B]/95 px-6 py-3">
      <div class="flex items-baseline gap-4">
        <span class="text-lg font-black tracking-[0.3em]">WORDS TO WEBSITE</span>
        <span class="border border-[#E0492E] px-2 py-0.5 font-mono text-[10px] tracking-widest text-[#E0492E]">现场大屏 · 投影</span>
      </div>
      <div class="flex items-center gap-6 font-mono text-[11px] text-[#7FA8C4]">
        <span v-if="demoCount > 0" class="text-[#FFC53D]">演示模式 ×{{ demoCount }}</span>
        <span>已上线 <b class="text-[#EAF4FA]">{{ items.length - demoCount }}</b> 个网页</span>
        <span class="hidden sm:inline">SHEET 01 · SCALE 1:1</span>
      </div>
    </header>

    <!-- 空态 -->
    <div v-if="items.length === 0" class="grid flex-1 place-items-center">
      <div class="text-center text-[#7FA8C4]">
        <div class="mx-auto h-16 w-16 rounded-full border-2 border-dashed border-[#4E7A9B]"></div>
        <p class="mt-5 font-mono text-xs tracking-widest">WAITING FOR THE FIRST PAGE…</p>
      </div>
    </div>

    <!-- 滚动墙：横屏多轨，交替方向，悬停暂停 -->
    <div v-else class="grid flex-1 grid-rows-[var(--track-n)] gap-4 overflow-hidden p-4" :style="{ '--track-n': tracks.length }">
      <div
        v-for="(track, ti) in tracks"
        :key="ti"
        class="overflow-hidden"
      >
        <div
          class="flex h-full w-max items-center gap-4 wall-track"
          :class="ti % 2 === 1 && 'wall-track--rtl'"
          :style="{ '--dur': duration(track) + 's' }"
        >
          <div
            v-for="(it, i) in loop(track)"
            :key="`${it.taskId}-${i}`"
            class="wall-card"
          >
            <!-- 页面预览 -->
            <div class="h-full overflow-hidden rounded-t-lg border-x border-t border-[rgba(214,236,248,.25)]">
              <LazyFrame
                v-if="it.demoIndex !== undefined"
                :srcdoc="demoPage(it.demoIndex)"
                :title="it.domain ?? ''"
              />
              <LazyFrame
                v-else-if="it.hasScreenshot"
                :src="`/api/tasks/${it.taskId}/screenshot`"
                :title="it.domain ?? ''"
              />
              <LazyFrame v-else :src="`/api/tasks/${it.taskId}/html`" :title="it.domain ?? ''" />
            </div>
            <!-- 卡脚：门牌 + 红章编号 -->
            <div class="flex items-center justify-between gap-2 rounded-b-lg border-x border-b border-[rgba(214,236,248,.25)] bg-[#0B2E4B] px-3 py-2">
              <span class="truncate font-mono text-[11px] text-[#EAF4FA]">{{ it.domain ?? it.taskId }}</span>
              <span class="shrink-0 rotate-[-4deg] border-2 border-[#E0492E] px-1.5 py-px font-mono text-[10px] font-semibold tracking-widest text-[#E0492E]">{{ it.code }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 卡片：竖版小页，高随轨道自适应 */
.wall-card {
  height: 100%;
  aspect-ratio: 5 / 8;
  min-width: 200px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.35);
}
.wall-card > div:first-child { flex: 1; }

@keyframes wall-scroll-ltr { from { transform: translateX(0); } to { transform: translateX(-50%); } }
@keyframes wall-scroll-rtl { from { transform: translateX(-50%); } to { transform: translateX(0); } }

.wall-track { animation: wall-scroll-ltr var(--dur) linear infinite; }
.wall-track--rtl { animation-name: wall-scroll-rtl; }
.wall-track:hover { animation-play-state: paused; }

@media (prefers-reduced-motion: reduce) {
  .wall-track { animation: none; }
  .wall-track:hover { overflow-x: auto; }
}
</style>
