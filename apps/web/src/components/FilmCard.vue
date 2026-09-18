<script setup lang="ts">
import LazyFrame from "@/components/LazyFrame.vue";
import { demoPage } from "@/lib/demoPages";
import { apiUrl } from "@/lib/apiBase";

/**
 * 胶卷上的「一格底片」：页面预览 + 卡脚（门牌域名 + 凭证章）。
 * 尺寸由父级给定（桌面 146×234、手机 ≈118×189），内容按比例缩放；
 * 远端压暗由父层通过 CSS 变量 --veil 控制（0=全亮）。
 */
const props = withDefaults(
  defineProps<{
    taskId: string;
    code: string | null;
    domain: string | null;
    url: string | null;
    hasScreenshot: boolean;
    demoIndex?: number;
    w: number;
    h: number;
  }>(),
  { demoIndex: undefined },
);

const footH = props.h * 0.145; // 卡脚高度 ≈ 桌面 34 / 手机 27
const fs = props.w / 146; // 相对桌面卡的比例，用于字号缩放
</script>

<template>
  <div
    class="relative"
    :style="{ width: w + 'px', height: h + 'px', fontSize: fs + 'px' }"
  >
    <div class="absolute inset-0 overflow-hidden bg-[#26231F]">
      <!-- 页面预览 -->
      <div class="absolute inset-x-0 top-0" :style="{ bottom: footH + 'px' }">
        <LazyFrame
          v-if="demoIndex !== undefined"
          :srcdoc="demoPage(demoIndex ?? 0)"
          :title="props.domain ?? ''"
        />
        <LazyFrame
          v-else-if="props.hasScreenshot"
          :src="apiUrl(`/api/tasks/${props.taskId}/screenshot`)"
          :title="props.domain ?? ''"
        />
        <LazyFrame
          v-else
          :src="apiUrl(`/api/tasks/${props.taskId}/html`)"
          :title="props.domain ?? ''"
        />
      </div>
      <!-- 卡脚：门牌 + 凭证章 -->
      <div
        class="absolute inset-x-0 bottom-0 flex items-center justify-between gap-[0.4em] border-t border-[rgba(247,212,71,.25)] bg-[#1C1917] px-[0.6em]"
        :style="{ height: footH + 'px' }"
      >
        <span
          class="truncate font-mono font-semibold text-[#FAF7E8]"
          style="font-size: 0.76em"
          >{{ props.domain ?? props.taskId }}</span
        >
        <span
          v-if="props.code"
          class="shrink-0 -rotate-[4deg] border-[0.14em] border-[#F7D447] px-[0.4em] py-[0.06em] font-mono font-bold tracking-widest text-[#F7D447]"
          style="font-size: 0.68em"
          >{{ props.code }}</span
        >
      </div>
      <!-- 黄色染色 + 远端压暗（跟随带的纵深） -->
      <div
        class="pointer-events-none absolute inset-0 bg-[rgba(247,212,71,.06)]"
      />
      <div
        class="pointer-events-none absolute inset-0 bg-[rgba(18,16,14,1)]"
        style="opacity: var(--veil, 0)"
      />
      <!-- 底片框内侧的那 1.5px 暗边 -->
      <div
        class="pointer-events-none absolute inset-0 shadow-[inset_0_0_0_1.5px_rgba(14,12,10,.85)]"
      />
    </div>
    <!-- 底片框：定稿是「3px 描边居中在 +4 矩形上」→ 外扩 3.5px（画在裁剪层之外，否则会被裁掉） -->
    <div
      class="pointer-events-none absolute -inset-[3.5px] border-[3.5px] border-[rgba(14,12,10,.85)]"
    />
  </div>
</template>
