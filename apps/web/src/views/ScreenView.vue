<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed } from "vue";
import { api } from "@/composables/useApi";

interface ScreenItem {
  taskId: string;
  code: string | null;
  domain: string | null;
  url: string | null;
  prompt: string;
  hasScreenshot: boolean;
  createdAt: number;
}

const items = ref<ScreenItem[]>([]);
let pollTimer: ReturnType<typeof setInterval> | null = null;

async function refresh() {
  try {
    items.value = await api<ScreenItem[]>("/api/screen/all");
  } catch {
    /* 弱网容忍 */
  }
}
onMounted(() => {
  void refresh();
  pollTimer = setInterval(refresh, 15_000);
});
onUnmounted(() => pollTimer && clearInterval(pollTimer));

// 列表复制一份衔接首尾,实现无缝循环滚动
const loopItems = computed(() => (items.value.length > 1 ? [...items.value, ...items.value] : items.value));
const columnCount = computed(() => (items.value.length > 6 ? 3 : items.value.length > 2 ? 2 : 1));
const animationDuration = computed(() => Math.max(30, items.value.length * 12));
</script>

<template>
  <div class="fixed inset-0 overflow-hidden bg-slate-950 text-white">
    <!-- 顶部标题栏 -->
    <header class="absolute inset-x-0 top-0 z-10 flex items-center justify-between bg-gradient-to-b from-slate-950/95 to-transparent px-8 py-5">
      <div class="flex items-center gap-3">
        <span class="text-2xl font-bold tracking-wide">Words to Website</span>
        <span class="rounded-full bg-violet-500/20 px-3 py-1 text-xs text-violet-300">现场大屏</span>
      </div>
      <span class="text-sm text-slate-400">已上线 {{ items.length }} 个网页</span>
    </header>

    <div v-if="loopItems.length === 0" class="flex h-full items-center justify-center">
      <div class="text-center text-slate-500">
        <div class="text-6xl font-thin">...)</div>
        <p class="mt-4">等待第一个网页上线</p>
      </div>
    </div>

    <!-- 滚动墙 -->
    <div v-else class="h-full overflow-hidden pt-20 pb-6">
      <div
        class="flex flex-col flex-wrap content-start gap-6 px-8 h-full animate-scroll"
        :style="{ '--cols': columnCount, '--duration': animationDuration + 's', 'max-height': '100%' }"
      >
        <div
          v-for="(it, i) in loopItems"
          :key="`${it.taskId}-${i}`"
          class="w-[calc((100%-var(--cols)*1.5rem)*1/var(--cols))] shrink-0 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-xl"
        >
          <!-- 截图优先,无截图降级 iframe 实时预览 -->
          <div class="relative aspect-[420/560] w-full bg-slate-950">
            <img
              v-if="it.hasScreenshot"
              :src="`/api/tasks/${it.taskId}/screenshot`"
              class="h-full w-full object-cover object-top"
              :alt="it.domain ?? it.code ?? ''"
            />
            <iframe
              v-else-if="it.url"
              :src="`/api/tasks/${it.taskId}/html`"
              sandbox="allow-scripts"
              class="h-full w-full border-0"
              scrolling="no"
              :title="it.domain ?? ''"
            />
          </div>
          <div class="space-y-1 px-4 py-3">
            <div class="flex items-center justify-between gap-2">
              <span class="truncate font-mono text-sm text-violet-300">{{ it.domain ?? it.taskId }}</span>
              <span class="shrink-0 rounded-md bg-violet-500/15 px-2 py-0.5 font-mono text-xs tracking-wider text-violet-200">{{ it.code }}</span>
            </div>
            <p class="truncate text-xs text-slate-400">{{ it.prompt }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes wall-scroll {
  0% { transform: translateY(0); }
  100% { transform: translateY(-50%); }
}
.animate-scroll {
  animation: wall-scroll var(--duration) linear infinite;
}
.animate-scroll:hover {
  animation-play-state: paused;
}
</style>
