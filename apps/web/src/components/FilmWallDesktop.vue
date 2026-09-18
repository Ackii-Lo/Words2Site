<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import FilmCard from "@/components/FilmCard.vue";
import type { WallItem } from "@/lib/wall";
import {
  A0,
  SPEED,
  STRIDE,
  RIBBON_A,
  RIBBON_B,
  atLs,
  buildBand,
  cardQuad,
  footDesk,
  ghostMarkup,
  headDesk,
  holesAt,
  homography,
  lRange,
  matrix3d,
  norm,
  type Band,
} from "@/lib/filmRibbon";

/**
 * B 方案桌面大屏：双胶卷透视滚墙。
 * 上带左近右远（卡右→左走），下带左远右近（卡左→右走）——每条带朝
 * 自己的近端走，两条带互为反向。带体/齿孔走 SVG；卡片是 HTML，
 * 用单应（matrix3d）贴到带面上，rAF 每帧只更新 transform 与齿孔。
 */
const props = defineProps<{ items: WallItem[]; demoCount: number }>();

const W = 1920;
const H = 1080;

const bandA = buildBand(RIBBON_A, {
  gid: "A",
  nearLeft: true,
  floor: 0.05,
  dimMax: 0.24,
});
const bandB = buildBand(RIBBON_B, {
  gid: "B",
  nearLeft: false,
  floor: 0.06,
  dimMax: 0.28,
});

// 屏内弧长范围（两端多留 240，让卡片完整进出画面再回收）
function bounds(band: Band): [number, number] {
  const [a, b] = lRange(band, -240, W + 240);
  return [Math.max(a, 80), Math.min(b, band.Lmax - 80)];
}
const rngA = bounds(bandA);
const rngB = bounds(bandB);

const underSvg = ghostMarkup() + bandB.body;
const bandASvg = bandA.body;

const wrap = ref<HTMLElement | null>(null);
const stage = ref<HTMLElement | null>(null);
const holesA = ref<SVGElement | null>(null);
const holesB = ref<SVGElement | null>(null);
const slotsA = ref<number[]>([]);
const slotsB = ref<number[]>([]);
const elsA = new Map<number, HTMLElement>();
const elsB = new Map<number, HTMLElement>();

function bindEl(map: Map<number, HTMLElement>, n: number, el: unknown) {
  if (el) map.set(n, el as HTMLElement);
  else map.delete(n);
}

const itemAt = (n: number): WallItem | undefined => {
  const L = props.items.length;
  if (L === 0) return undefined;
  return props.items[((n % L) + L) % L];
};
/** 供模板 v-bind 用（外层 v-if 已保证存在） */
const cardAt = (n: number): WallItem => itemAt(n) as WallItem;

const empty = () => props.items.length === 0;
const liveCount = () => props.items.length - props.demoCount;
const topSvg = () =>
  headDesk(liveCount(), props.demoCount) + footDesk(props.items.length);
const emptySvg =
  // 承托面板：空态提示会落在胶片轨上，加一层近黑底 + 黄虚线框把提示托出来
  `<rect x="650" y="418" width="620" height="238" rx="8" fill="#17140F" fill-opacity=".94" stroke="rgba(247,212,71,.32)" stroke-width="1.5" stroke-dasharray="9 9"/>` +
  `<circle cx="960" cy="510" r="56" fill="none" stroke="rgba(247,212,71,.55)" stroke-width="2.5" stroke-dasharray="11 11"/>` +
  `<text x="960" y="618" text-anchor="middle" font-family="Consolas,Menlo,monospace" font-size="16" letter-spacing="4.5" fill="rgba(247,212,71,.78)">WAITING FOR THE FIRST PAGE…</text>`;

// ---------- 动画 ----------
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
let t = 0;
let last = performance.now();
let paused = false;
let raf = 0;

function renderBand(
  band: Band,
  rng: [number, number],
  dir: number,
  phase: number,
  slots: { value: number[] },
  els: Map<number, HTMLElement>,
  holesEl: SVGElement | null,
) {
  const ph = dir * phase;
  const nMin = Math.ceil((rng[0] - A0 - ph) / STRIDE);
  const nMax = Math.floor((rng[1] - A0 - ph) / STRIDE);
  const list: number[] = [];
  for (let n = nMin; n <= nMax; n++) list.push(n);
  const cur = slots.value;
  if (
    cur.length !== list.length ||
    (list.length > 0 &&
      (cur[0] !== list[0] || cur[cur.length - 1] !== list[list.length - 1]))
  ) {
    slots.value = list;
  }
  for (const [n, el] of els) {
    const l = A0 + n * STRIDE + ph;
    const h = homography(cardQuad(band, l));
    el.style.transform = matrix3d(h, 146, 234);
    const p = atLs(band.P, l);
    const veil =
      band.floor + (band.dimMax - band.floor) * (1 - norm(band, p.k));
    el.style.setProperty("--veil", veil.toFixed(3));
    el.style.visibility = "visible";
  }
  if (holesEl) holesEl.innerHTML = holesAt(band, ph);
}

function frame(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (!paused && !reduced) t += dt;
  const phase = t * SPEED;
  renderBand(bandB, rngB, 1, phase, slotsB, elsB, holesB.value);
  renderBand(bandA, rngA, -1, phase, slotsA, elsA, holesA.value);
  raf = requestAnimationFrame(frame);
}

// ---------- 缩放（设计画布 cover 铺满视口） ----------
function fit() {
  if (!stage.value || !wrap.value) return;
  const s = Math.max(wrap.value.clientWidth / W, wrap.value.clientHeight / H);
  stage.value.style.transform = `scale(${s})`;
}

function onEnter() {
  paused = true;
}
function onLeave() {
  paused = false;
}

onMounted(() => {
  fit();
  addEventListener("resize", fit);
  raf = requestAnimationFrame(frame);
});
onUnmounted(() => {
  removeEventListener("resize", fit);
  cancelAnimationFrame(raf);
});
</script>

<template>
  <div
    ref="wrap"
    class="absolute inset-0 overflow-hidden bg-[#1C1917]"
    @mouseenter="onEnter"
    @mouseleave="onLeave"
  >
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
        v-html="underSvg"
      />
      <svg
        ref="holesB"
        class="film-svg pointer-events-none absolute left-0 top-0"
        :width="W"
        :height="H"
        :viewBox="`0 0 ${W} ${H}`"
      />
      <div
        class="pointer-events-none absolute left-0 top-0"
        :style="{ width: W + 'px', height: H + 'px' }"
      >
        <div
          v-for="n in slotsB"
          :key="'B' + n"
          :ref="(el) => bindEl(elsB, n, el)"
          class="fcard"
        >
          <FilmCard v-if="itemAt(n)" v-bind="cardAt(n)" :w="146" :h="234" />
        </div>
      </div>
      <svg
        class="film-svg pointer-events-none absolute left-0 top-0"
        :width="W"
        :height="H"
        :viewBox="`0 0 ${W} ${H}`"
        v-html="bandASvg"
      />
      <svg
        ref="holesA"
        class="film-svg pointer-events-none absolute left-0 top-0"
        :width="W"
        :height="H"
        :viewBox="`0 0 ${W} ${H}`"
      />
      <div
        class="pointer-events-none absolute left-0 top-0"
        :style="{ width: W + 'px', height: H + 'px' }"
      >
        <div
          v-for="n in slotsA"
          :key="'A' + n"
          :ref="(el) => bindEl(elsA, n, el)"
          class="fcard"
        >
          <FilmCard v-if="itemAt(n)" v-bind="cardAt(n)" :w="146" :h="234" />
        </div>
      </div>
      <svg
        class="film-svg pointer-events-none absolute left-0 top-0"
        :width="W"
        :height="H"
        :viewBox="`0 0 ${W} ${H}`"
        v-html="topSvg()"
      />
      <svg
        v-if="empty()"
        class="film-svg pointer-events-none absolute left-0 top-0"
        :width="W"
        :height="H"
        :viewBox="`0 0 ${W} ${H}`"
        v-html="emptySvg"
      />
    </div>
  </div>
</template>

<style scoped>
.film-svg {
  font-family:
    -apple-system, "PingFang SC", "Microsoft YaHei", Arial, sans-serif;
}
.fcard {
  position: absolute;
  left: 0;
  top: 0;
  visibility: hidden; /* 首帧定位后再显示，避免新卡在左上角闪现 */
  transform-origin: 0 0;
  will-change: transform;
}
</style>
