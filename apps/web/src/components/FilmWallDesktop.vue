<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import FilmCard from "@/components/FilmCard.vue";
import { t } from "@/i18n";
import type { WallItem } from "@/lib/wall";
import {
  A0,
  CARD_H,
  CARD_W,
  HW,
  PERF,
  SPEED,
  STRIDE,
  Y,
  RIBBON_A,
  RIBBON_B,
  atLs,
  buildBand,
  cardQuad,
  footDesk,
  ghostMarkup,
  headDesk,
  homography,
  lRange,
  matrix3d,
  norm,
  type Band,
} from "@/lib/filmRibbon";

/**
 * B 方案桌面大屏：双胶卷透视滚墙。
 * 上带左近右远（卡右→左走），下带左远右近（卡左→右走）——每条带朝
 * 自己的近端走，两条带互为反向。带体走 SVG；齿孔走画布；
 * 卡片是 HTML，两级变换贴到带面上（外层每帧只改位移、内层形变低频更新）。
 *
 * 性能约束（2026-09-19 上线后实测）：主线程开销必须压低——
 * 齿孔每帧重建 SVG 字符串要吃掉约 24% 单核，已改画布重绘；
 * 卡片逐帧写整条 matrix3d 会让每层重新栅格化（掉帧/闪烁），
 * 已拆成「外层位移 + 内层形变」两级。
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
const holesA = ref<HTMLCanvasElement | null>(null);
const holesB = ref<HTMLCanvasElement | null>(null);
const slotsA = ref<number[]>([]);
const slotsB = ref<number[]>([]);

/** 卡片两级结构：outer 每帧改位移；inner 只在形变超阈值时重写 */
interface El {
  outer: HTMLElement;
  inner: HTMLElement | null;
  /** 上次写入内层时的局部缩放，用于形变阈值判定 */
  sc?: number;
}
const elsA = new Map<number, El>();
const elsB = new Map<number, El>();

function slot(map: Map<number, El>, n: number): El {
  const cur = map.get(n);
  if (cur) return cur;
  const rec: El = { outer: null as unknown as HTMLElement, inner: null };
  map.set(n, rec);
  return rec;
}
/**
 * 脏标记：Vue 补丁后才把真实元素交给渲染循环（bindOuter/bindInner），
 * 此时相位可能没变——必须强制补渲染一帧，否则新卡的 transform 永远写不上。
 * 「减少动效」下相位恒定，不补这一帧就是整墙空白（2026-09-19 实测复现）。
 */
let dirty = false;
function bindOuter(map: Map<number, El>, n: number, el: unknown) {
  if (el) slot(map, n).outer = el as HTMLElement;
  else map.delete(n);
  dirty = true;
}
function bindInner(map: Map<number, El>, n: number, el: unknown) {
  const rec = map.get(n);
  if (rec && el) rec.inner = el as HTMLElement;
  else if (rec) rec.inner = null;
  dirty = true;
}

const itemAt = (n: number): WallItem | undefined => {
  const L = props.items.length;
  if (L === 0) return undefined;
  return props.items[((n % L) + L) % L];
};
/** 供模板 v-bind 用（外层 v-if 已保证存在） */
const cardAt = (n: number): WallItem => itemAt(n) as WallItem;

const empty = () => props.items.length === 0;
// 标题/厂牌 SVG 依赖 locale（切换语言即时重算）
const topSvg = computed(
  () =>
    headDesk(props.items.length - props.demoCount, props.demoCount, {
      badge: t("screen.badge"),
      onlinePre: t("screen.onlinePre"),
      onlinePost: t("screen.onlinePost"),
      demo: t("screen.demo", { n: props.demoCount }),
    }) + footDesk(props.items.length),
);
const emptySvg =
  // 承托面板：空态提示会落在胶片轨上，加一层近黑底 + 黄虚线框把提示托出来
  `<rect x="650" y="418" width="620" height="238" rx="8" fill="#17140F" fill-opacity=".94" stroke="rgba(247,212,71,.32)" stroke-width="1.5" stroke-dasharray="9 9"/>` +
  `<circle cx="960" cy="510" r="56" fill="none" stroke="rgba(247,212,71,.55)" stroke-width="2.5" stroke-dasharray="11 11"/>` +
  `<text x="960" y="618" text-anchor="middle" font-family="Consolas,Menlo,monospace" font-size="16" letter-spacing="4.5" fill="rgba(247,212,71,.78)">WAITING FOR THE FIRST PAGE…</text>`;

// ---------- 动画 ----------
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
let elapsed = 0; // 累计走带时间（s）；改名避免与 i18n 的 t() 撞名
let last = performance.now();
let paused = false;
let raf = 0;
/** 30fps 渲染门限：走带速度约 14px/s（屏幕），60→30fps 每帧位移 0.46px，肉眼无感 */
const FRAME_MS = 33;
let lastRenderAt = 0;
/** 上次渲染的相位：未变化则跳过整帧（悬停/减少动效时白算归零） */
let renderedPhase = -1;
/** 画布像素比（DPR × 舞台缩放，封顶 2），保齿孔清晰又不过度分配 */
const hpx = ref(1);

/** 针孔：把 homography 平移到以卡片中心为原点（内层用） */
function centered(h: number[], cx: number, cy: number): number[] {
  return [
    h[0] - cx * h[6],
    h[1] - cx * h[7],
    h[2] - cx,
    h[3] - cy * h[6],
    h[4] - cy * h[7],
    h[5] - cy,
    h[6],
    h[7],
  ];
}

/**
 * 形变是否需要重算：局部缩放相对变化 > 0.5% 才重写内层 matrix3d。
 * 卡片位移（外层）是每帧精确的，形变滞后<1px，肉眼不可辨；
 * 换来的是内层图层不逐帧重新栅格化。
 */
function needsReshape(rec: El, h: number[]): boolean {
  const sc = Math.hypot(h[0], h[3]);
  if (rec.sc === undefined) {
    rec.sc = sc;
    return true;
  }
  if (Math.abs(sc - rec.sc) / (rec.sc || 1) < 0.005) return false;
  rec.sc = sc;
  return true;
}

let ctxA: CanvasRenderingContext2D | null = null;
let ctxB: CanvasRenderingContext2D | null = null;

/**
 * 齿孔：整块画布重绘。
 * 旧实现每帧拼 SVG 字符串再 innerHTML 覆盖（约 900 个节点重建），
 * 实测占单核约 24%——画布只做「清屏 + 画小方块」，无 DOM、无样式重算。
 */
function drawHoles(
  cv: HTMLCanvasElement | null,
  ctx: CanvasRenderingContext2D | null,
  band: Band,
  phase: number,
) {
  if (!cv || !ctx) return;
  const k = hpx.value;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.fillStyle = Y;
  const P0 = PERF * 0.58;
  const rounded = typeof ctx.roundRect === "function";
  for (
    let n = Math.ceil((26 - P0 - phase) / PERF);
    P0 + n * PERF + phase <= band.Lmax - 26;
    n++
  ) {
    const l = P0 + n * PERF + phase;
    const p = atLs(band.P, l);
    if (p.x < -160 || p.x > W + 160) continue;
    const ang = Math.atan2(p.ty, p.tx);
    const cos = Math.cos(ang);
    const sin = Math.sin(ang);
    const sk = k * p.k;
    const off = (HW - 13) * p.k;
    ctx.globalAlpha = 0.42 + 0.58 * norm(band, p.k);
    for (const sx of [1, -1]) {
      const cx = p.x + p.nx * off * sx;
      const cy = p.y + p.ny * off * sx;
      ctx.setTransform(cos * sk, sin * sk, -sin * sk, cos * sk, cx * k, cy * k);
      ctx.beginPath();
      if (rounded) ctx.roundRect(-8, -5.5, 16, 11, 2.4);
      else ctx.rect(-8, -5.5, 16, 11);
      ctx.fill();
    }
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
}

function renderBand(
  band: Band,
  rng: [number, number],
  dir: number,
  phase: number,
  slots: { value: number[] },
  els: Map<number, El>,
  cv: HTMLCanvasElement | null,
  ctx: CanvasRenderingContext2D | null,
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
  for (const [n, rec] of els) {
    const el = rec.outer;
    const l = A0 + n * STRIDE + ph;
    const h = homography(cardQuad(band, l));
    // 卡片中心在屏幕上的位置：外层只做纯位移（合成器可平移，不重新栅格化）
    const den = h[6] * 0.5 + h[7] * 0.5 + 1;
    const cx = (h[0] * 0.5 + h[1] * 0.5 + h[2]) / den;
    const cy = (h[3] * 0.5 + h[4] * 0.5 + h[5]) / den;
    el.style.transform = `translate3d(${cx.toFixed(2)}px,${cy.toFixed(2)}px,0)`;
    if (rec.inner && needsReshape(rec, h)) {
      // 内层相对外层原点自带 (-CARD_W/2, -CARD_H/2) 偏移（让卡心落在外层原点上），
      // 所以单应要按「卡心 − 这个偏移」归位。写成 centered(h, cx, cy) 会让整张卡
      // 往左上偏半张卡（e949835 引入，2026-09-19 线上截图比对时发现）。
      rec.inner.style.transform = matrix3d(
        centered(h, cx - CARD_W / 2, cy - CARD_H / 2),
        CARD_W,
        CARD_H,
      );
    }
    const p = atLs(band.P, l);
    const veil =
      band.floor + (band.dimMax - band.floor) * (1 - norm(band, p.k));
    // 量化到 1/24：远端卡片亮度帧间几乎不变，省掉逐帧样式重算
    const vs = String(Math.round(veil * 24) / 24);
    if (el.dataset.v !== vs) {
      el.dataset.v = vs;
      el.style.setProperty("--veil", vs);
    }
    if (el.style.visibility !== "visible") el.style.visibility = "visible";
  }
  drawHoles(cv, ctx, band, ph);
}

function frame(now: number) {
  raf = requestAnimationFrame(frame);
  // 整体 30fps 门控：单应求解、transform/veil 赋值、齿孔绘制全部减半
  if (now - lastRenderAt < FRAME_MS) return;
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  lastRenderAt = now;
  if (!paused && !reduced) elapsed += dt;
  const phase = elapsed * SPEED;
  // 相位未变且没有待补的新卡片（悬停/减少动效）→ 画面无变化，整帧跳过
  if (phase === renderedPhase && !dirty) return;
  dirty = false;
  renderedPhase = phase;
  renderBand(bandB, rngB, 1, phase, slotsB, elsB, holesB.value, ctxB);
  renderBand(bandA, rngA, -1, phase, slotsA, elsA, holesA.value, ctxA);
}

// ---------- 缩放（设计画布 cover 铺满视口） ----------
function fit() {
  if (!stage.value || !wrap.value) return;
  const s = Math.max(wrap.value.clientWidth / W, wrap.value.clientHeight / H);
  stage.value.style.transform = `scale(${s})`;
  // 齿孔画布按实际显示尺寸分配像素，封顶 2x（再高清也看不出，只烧显存）
  const want = Math.min(2, Math.max(1, s * (devicePixelRatio || 1)));
  if (Math.abs(want - hpx.value) > 0.05) {
    hpx.value = want;
    for (const cv of [holesA.value, holesB.value]) {
      if (!cv) continue;
      cv.width = Math.round(W * want);
      cv.height = Math.round(H * want);
    }
    renderedPhase = -1; // 重绘一帧
  }
}

function onEnter() {
  paused = true;
}
function onLeave() {
  paused = false;
}

onMounted(() => {
  fit();
  ctxA = holesA.value?.getContext("2d") ?? null;
  ctxB = holesB.value?.getContext("2d") ?? null;
  addEventListener("resize", fit);
  document.addEventListener("visibilitychange", onVis);
  raf = requestAnimationFrame(frame);
});
onUnmounted(() => {
  removeEventListener("resize", fit);
  document.removeEventListener("visibilitychange", onVis);
  cancelAnimationFrame(raf);
});

// 标签页隐藏时彻底停摆（投影仪切信号/值班机切窗口不再空烧 CPU/GPU）
function onVis() {
  if (document.hidden) {
    cancelAnimationFrame(raf);
    raf = 0;
  } else if (!raf) {
    last = performance.now();
    lastRenderAt = 0;
    raf = requestAnimationFrame(frame);
  }
}
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
      <canvas
        ref="holesB"
        class="pointer-events-none absolute left-0 top-0"
        :width="Math.round(W * hpx)"
        :height="Math.round(H * hpx)"
        :style="{ width: W + 'px', height: H + 'px' }"
      />
      <div
        class="pointer-events-none absolute left-0 top-0"
        :style="{ width: W + 'px', height: H + 'px' }"
      >
        <div
          v-for="n in slotsB"
          :key="'B' + n"
          :ref="(el) => bindOuter(elsB, n, el)"
          class="fcard"
        >
          <div :ref="(el) => bindInner(elsB, n, el)" class="fcard-inner">
            <FilmCard v-if="itemAt(n)" v-bind="cardAt(n)" :w="146" :h="234" />
          </div>
        </div>
      </div>
      <svg
        class="film-svg pointer-events-none absolute left-0 top-0"
        :width="W"
        :height="H"
        :viewBox="`0 0 ${W} ${H}`"
        v-html="bandASvg"
      />
      <canvas
        ref="holesA"
        class="pointer-events-none absolute left-0 top-0"
        :width="Math.round(W * hpx)"
        :height="Math.round(H * hpx)"
        :style="{ width: W + 'px', height: H + 'px' }"
      />
      <div
        class="pointer-events-none absolute left-0 top-0"
        :style="{ width: W + 'px', height: H + 'px' }"
      >
        <div
          v-for="n in slotsA"
          :key="'A' + n"
          :ref="(el) => bindOuter(elsA, n, el)"
          class="fcard"
        >
          <div :ref="(el) => bindInner(elsA, n, el)" class="fcard-inner">
            <FilmCard v-if="itemAt(n)" v-bind="cardAt(n)" :w="146" :h="234" />
          </div>
        </div>
      </div>
      <svg
        class="film-svg pointer-events-none absolute left-0 top-0"
        :width="W"
        :height="H"
        :viewBox="`0 0 ${W} ${H}`"
        v-html="topSvg"
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
    <!-- 去做网页的入口：右下角 START 按钮。钉在视口（非画布坐标）——
         舞台是 cover 缩放（超出部分被裁），画布右下角在超宽/带栏视口会裁出屏外 -->
    <RouterLink
      to="/start"
      class="start-link"
      :aria-label="t('screen.start')"
      :title="t('screen.start')"
    >
      START
    </RouterLink>
  </div>
</template>

<style scoped>
.film-svg {
  font-family:
    -apple-system, "PingFang SC", "Microsoft YaHei", Arial, sans-serif;
}
/**
 * 两级变换：外层每帧只改 translate3d（合成器平移，不触发重新栅格化），
 * 内层承载单应形变（低频更新）。旧版把整条 matrix3d 写到同一个元素上，
 * 每帧都要重新栅格化整张卡——既是功耗大头，也是页面区闪烁的来源。
 */
.fcard {
  position: absolute;
  left: 0;
  top: 0;
  visibility: hidden; /* 首帧定位后再显示，避免新卡在左上角闪现 */
  transform-origin: 0 0;
  will-change: transform;
}
.fcard-inner {
  position: absolute;
  left: -73px; /* 卡片半宽：让卡心落在外层原点 */
  top: -117px; /* 卡片半高 */
  width: 146px;
  height: 234px;
  transform-origin: 0 0;
}
.start-link {
  position: absolute;
  right: 28px;
  bottom: 28px;
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 350px;
  height: 46px;
  background: #f7d447;
  color: #1c1917;
  font-family: Consolas, Menlo, ui-monospace, monospace;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 4px;
  text-indent: 4px;
  border-radius: 10px;
  text-decoration: none;
}
.start-link:hover {
  filter: brightness(1.08);
  outline: 1.5px dashed rgba(247, 212, 71, 0.75);
  outline-offset: 5px;
}
</style>
