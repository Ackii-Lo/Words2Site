<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";

/**
 * 懒加载 iframe：进入视口（含预载边距）才挂载内容，远离视口自动卸载，
 * 让滚动墙可以承载任意数量的页面而内存有界。
 * 真实页面传 src；演示页传 srcdoc。
 */
defineProps<{
  src?: string;
  srcdoc?: string;
  title?: string;
}>();

const host = ref<HTMLElement | null>(null);
const live = ref(false);
let io: IntersectionObserver | null = null;

onMounted(() => {
  if (!host.value) return;
  io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) live.value = e.isIntersecting;
    },
    // 提前后各半个视口预载，滚动到之前已就绪
    { rootMargin: "50% 50% 50% 50%", threshold: 0 },
  );
  io.observe(host.value);
});
onUnmounted(() => io?.disconnect());
</script>

<template>
  <div ref="host" class="relative h-full w-full overflow-hidden bg-[#0B2E4B]">
    <!-- 占位：图纸网格 + 角标，等待进入预载区 -->
    <div
      v-if="!live"
      class="absolute inset-0 grid place-items-center bg-[linear-gradient(rgba(214,236,248,.05)_1px,transparent_1px),linear-gradient(90deg,rgba(214,236,248,.05)_1px,transparent_1px)] bg-[size:14px_14px]"
    >
      <span class="font-mono text-[10px] tracking-widest text-[#4E7A9B]"
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
