<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import FilmCard from "@/components/FilmCard.vue";
import type { WallItem } from "@/lib/wall";
import {
  PERF_TILE,
  PCH,
  PCW,
  PHW,
  PLEFT_Y,
  PHONE,
  PRIGHT_Y,
  PSTRIDE,
  bgPhone,
  footPhone,
  headPhone,
  phoneStripSvg,
} from "@/lib/filmRibbon";

/**
 * B 方案手机竖屏：双列竖排胶片（左列沉底、上滚；右列贴顶、下滚）。
 * 带体/暗部渐变是静态 SVG；齿孔用背景贴片做无缝滚动；
 * 卡片轨道内容复制一份，CSS translate 做无缝循环，末端 1/7 渐隐。
 */
const props = defineProps<{ items: WallItem[]; demoCount: number }>();

const W = PHONE.W;
const H = PHONE.H;
const CX_L = 22 + PHW; // 左列中心
const CX_R = W - 22 - PHW; // 右列中心

const stripL = phoneStripSvg("L", CX_L, PLEFT_Y[0], PLEFT_Y[1]);
const stripR = phoneStripSvg("R", CX_R, PRIGHT_Y[0], PRIGHT_Y[1]);
const chromeSvg =
  bgPhone() + stripL + stripR + headPhone() + footPhone(props.demoCount);

const wrap = ref<HTMLElement | null>(null);
const stage = ref<HTMLElement | null>(null);

const empty = computed(() => props.items.length === 0);

/** 轨道内容（复制一份衔接首尾）；卡序 = 进入端 → 远端 */
function track(items: WallItem[], offset: number): WallItem[] {
  const L = items.length;
  if (L === 0) return [];
  const out: WallItem[] = [];
  for (let i = 0; i < L; i++) out.push(items[(((i + offset) % L) + L) % L]);
  return [...out, ...out];
}
const trackL = computed(() => track(props.items, 0));
const trackR = computed(() =>
  track(props.items, Math.floor(props.items.length / 2)),
);

const perfTile = PERF_TILE;
/** 走完一个卡步长 / 一个齿孔步长的时间（s），两者同速 */
const DUR = PSTRIDE / 26;
const HOLE_DUR = PHONE.PPERF / 26;

const perfStyle = {
  width: PHW * 2 + "px",
  height: H + "px",
  backgroundImage: perfTile,
  animationDuration: HOLE_DUR + "s",
};
const cardColStyle = (y: [number, number]) => ({
  left: 0,
  top: y[0] + "px",
  height: y[1] - y[0] + "px",
});

function fit() {
  if (!stage.value || !wrap.value) return;
  const s = Math.max(wrap.value.clientWidth / W, wrap.value.clientHeight / H);
  stage.value.style.transform = `scale(${s})`;
}

onMounted(() => {
  fit();
  addEventListener("resize", fit);
});
onUnmounted(() => removeEventListener("resize", fit));
</script>

<template>
  <div ref="wrap" class="absolute inset-0 overflow-hidden bg-[#1C1917]">
    <div
      ref="stage"
      class="absolute left-0 top-0"
      :style="{ width: W + 'px', height: H + 'px', transformOrigin: '0 0' }"
    >
      <svg
        class="film-svg pointer-events-none absolute left-0 top-0"
        :width="W"
        :height="H"
        :viewBox="`0 0 ${W} ${H}`"
        v-html="chromeSvg"
      />
      <!-- 左列：齿孔贴片（上滚，铺满全屏高）+ 卡片轨道 -->
      <div
        class="perfs perf-up"
        :style="{ ...perfStyle, left: CX_L - PHW + 'px' }"
      />
      <div class="clip mask-fade-bottom" :style="cardColStyle(PLEFT_Y)">
        <div
          v-if="!empty"
          class="rail rail-up"
          :style="{ '--dur': DUR + 's', left: CX_L - PCW / 2 + 'px' }"
        >
          <div
            v-for="(it, i) in trackL"
            :key="i"
            class="pcard"
            :style="{
              width: PCW + 'px',
              height: PCH + 'px',
              marginBottom: PSTRIDE - PCH + 'px',
            }"
          >
            <FilmCard v-bind="it" :w="PCW" :h="PCH" />
          </div>
        </div>
      </div>
      <!-- 右列：齿孔贴片（下滚）+ 卡片轨道 -->
      <div
        class="perfs perf-down"
        :style="{ ...perfStyle, left: CX_R - PHW + 'px' }"
      />
      <div class="clip mask-fade-top" :style="cardColStyle(PRIGHT_Y)">
        <div
          v-if="!empty"
          class="rail rail-down"
          :style="{ '--dur': DUR + 's', left: CX_R - PCW / 2 + 'px' }"
        >
          <div
            v-for="(it, i) in trackR"
            :key="i"
            class="pcard"
            :style="{
              width: PCW + 'px',
              height: PCH + 'px',
              marginBottom: PSTRIDE - PCH + 'px',
            }"
          >
            <FilmCard v-bind="it" :w="PCW" :h="PCH" />
          </div>
        </div>
      </div>
      <!-- 空态 -->
      <svg
        v-if="empty"
        class="film-svg pointer-events-none absolute left-0 top-0"
        :width="W"
        :height="H"
        :viewBox="`0 0 ${W} ${H}`"
        v-html="
          `<rect x='37.5' y='322' width='300' height='158' rx='6' fill='#17140F' fill-opacity='.94' stroke='rgba(247,212,71,.32)' stroke-width='1.2' stroke-dasharray='7 7'/>` +
          `<circle cx='187.5' cy='386' r='38' fill='none' stroke='rgba(247,212,71,.55)' stroke-width='2.2' stroke-dasharray='9 9'/>` +
          `<text x='187.5' y='456' text-anchor='middle' font-family='Consolas,Menlo,monospace' font-size='11' letter-spacing='2.6' fill='rgba(247,212,71,.72)'>WAITING FOR THE FIRST PAGE…</text>`
        "
      />
    </div>
  </div>
</template>

<style scoped>
.film-svg {
  font-family:
    -apple-system, "PingFang SC", "Microsoft YaHei", Arial, sans-serif;
}
.clip {
  position: absolute;
  left: 0;
  width: 375px;
  overflow: hidden;
}
/* 卡片轨道：内容复制一份，位移 50% 即一个完整周期 */
.rail {
  position: absolute;
  will-change: transform;
  animation-duration: var(--dur);
  animation-timing-function: linear;
  animation-iteration-count: infinite;
}
.rail-up {
  animation-name: rail-scroll-up;
}
.rail-down {
  animation-name: rail-scroll-down;
}
@keyframes rail-scroll-up {
  from {
    transform: translateY(0);
  }
  to {
    transform: translateY(-50%);
  }
}
@keyframes rail-scroll-down {
  from {
    transform: translateY(-50%);
  }
  to {
    transform: translateY(0);
  }
}
/* 末端 1/7 渐隐（左列出上口、右列出下口） */
.mask-fade-bottom {
  mask-image: linear-gradient(to bottom, transparent 0%, #000 16.7%, #000 100%);
}
.mask-fade-top {
  mask-image: linear-gradient(to bottom, #000 0%, #000 83.3%, transparent 100%);
}
/* 齿孔贴片：与卡片同速滚动 */
.perfs {
  position: absolute;
  top: 0;
  background-repeat: repeat;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
}
.perf-up {
  animation-name: perf-scroll-up;
}
.perf-down {
  animation-name: perf-scroll-down;
}
@keyframes perf-scroll-up {
  from {
    background-position-y: 0;
  }
  to {
    background-position-y: -18.5px;
  }
}
@keyframes perf-scroll-down {
  from {
    background-position-y: -18.5px;
  }
  to {
    background-position-y: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .rail,
  .perfs {
    animation: none;
  }
}
</style>
