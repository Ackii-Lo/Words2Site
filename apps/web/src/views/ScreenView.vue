<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { api } from "@/composables/useApi";
import { demoItems } from "@/lib/demoPages";
import type { WallItem } from "@/lib/wall";
import FilmWallDesktop from "@/components/FilmWallDesktop.vue";
import FilmWallPhone from "@/components/FilmWallPhone.vue";
import LanguageSwitch from "@/components/LanguageSwitch.vue";

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

// 横屏走桌面双胶卷，竖屏走手机双列（舞台按设计画布等比缩放）
const portrait = ref(matchMedia("(orientation: portrait)").matches);
const onOri = () =>
  (portrait.value = matchMedia("(orientation: portrait)").matches);
onMounted(() => addEventListener("orientationchange", onOri));
onUnmounted(() => removeEventListener("orientationchange", onOri));
</script>

<template>
  <div class="fixed inset-0 overflow-hidden">
    <FilmWallDesktop v-if="!portrait" :items="items" :demo-count="demoCount" />
    <FilmWallPhone v-else :items="items" :demo-count="demoCount" />
    <!-- 语言切换：视口右上角，避开画布内 SHEET 01 标识 -->
    <LanguageSwitch variant="screen" class="absolute top-3 right-4 z-40" />
  </div>
</template>
