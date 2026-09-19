/**
 * 大屏 iframe 槽位池（模块级单例）。
 *
 * 为什么独立成模块：`<script setup>` 里的顶层变量是「每个组件实例一份」，
 * 写在组件里做全局上限根本不起作用（实测 27 个 iframe 照旧同时挂载）。
 * 全站共享的配额必须放在普通模块里，组件只注册/注销。
 */

/** 同时存活的 iframe 上限。
 *
 * 上限不省主线程（实测上限 8 / 16 / 不限，主线程都是 ~17–18%），它省的是每张卡
 * 背后那个生成页自己的 JS、动画与渲染进程——线上 27 个页面各自活着，才是一台
 * 机器「打开就卡、功耗大」的根源。所以上限是功耗闸门，不是速度优化。
 *
 * 取 16：板面卡片渲染高度 101–464px，最显眼的前 16 张（≥171px）都能拿到内容，
 * 剩下的是远端小卡，占位几乎看不出。
 */
export const MAX_LIVE = 16;

export interface FrameSlot {
  /** 当前是否在预载区内（想上屏） */
  want: boolean;
  /** 是否已占用槽位 */
  live: boolean;
  /** 优先级：越小越优先（距屏幕中心越近） */
  pri: () => number;
  /** 通知组件切到真实内容 */
  set: (v: boolean) => void;
  /** 拿到槽位的时间：用于抢占冷却，避免两张卡来回抢 */
  since?: number;
}

const slots = new Set<FrameSlot>();

/** 抢占有意义的优先级差（占视口高度的比例）。
 *  方向是单向的——只有「明显更优先」的卡能把差的换下去，被换下者不会再抢回来，
 *  所以阈值小也不会来回抖；但每次抢占 = 一次整页加载，别设成 0。 */
const SWAP_MARGIN = 0.05;
/** 抢占冷却（ms）：刚拿到的槽位短时间内不许被抢 */
const SWAP_COOLDOWN = 2000;

function liveCount(): number {
  let n = 0;
  for (const s of slots) if (s.live) n++;
  return n;
}

function take(s: FrameSlot): void {
  s.live = true;
  s.since = performance.now();
  s.set(true);
}

/**
 * 发槽位：有空槽就给等待中最优先的卡；池满时，只有当某张持有卡的优先级
 * 明显差于排队卡（SWAP_MARGIN）且已过冷却（SWAP_COOLDOWN）才换人。
 *
 * 为什么不能只回收「want=false」的卡：预载区（±50% 视口）几乎覆盖整块板面，
 * 大部分卡都处于 want 状态，于是先注册的 16 张会永久占坑，画面中心的大卡
 * 反而一直是占位。带阈值的抢占既能纠正优先级，又不会来回抖。
 *
 * 好处：内容在没人抢的时候一直留着——卡片离开预载区不再立刻卸载，
 * 回来也不用重新加载（省掉一次整页加载 + 页面区闪一下）。
 */
export function promote(): void {
  const waiting = [...slots]
    .filter((s) => s.want && !s.live)
    .sort((a, b) => a.pri() - b.pri());
  if (!waiting.length) return;
  let used = liveCount();
  for (const s of waiting) {
    if (used < MAX_LIVE) {
      take(s);
      used++;
      continue;
    }
    const now = performance.now();
    const mine = s.pri();
    // 池满：找优先级最差、且冷却已过的持有卡
    const worst = [...slots]
      .filter(
        (h) =>
          h.live &&
          h !== s &&
          now - (h.since ?? 0) > SWAP_COOLDOWN &&
          h.pri() > mine + SWAP_MARGIN,
      )
      .sort((a, b) => b.pri() - a.pri())[0];
    if (!worst) break; // 持有者都不比我差 → 排队等
    worst.live = false;
    worst.set(false);
    take(s);
  }
  rebalance();
}

/**
 * 有人在排队就每隔一会儿重算一次：卡片在动，优先级一直在变，
 * 只靠 IntersectionObserver 事件触发会漏掉「优先级悄悄反转」的情况。
 * 没有排队者时不留定时器，开销为零。
 */
let timer = 0;
function rebalance(): void {
  if (timer) return;
  if (!slots.size) return;
  let waiting = false;
  for (const s of slots)
    if (s.want && !s.live) {
      waiting = true;
      break;
    }
  if (!waiting) return;
  timer = window.setTimeout(() => {
    timer = 0;
    promote();
  }, 1200);
}

export function register(s: FrameSlot): void {
  slots.add(s);
  promote();
}

export function unregister(s: FrameSlot): void {
  slots.delete(s);
  promote();
}

/** 进入预载区：排队要槽位 */
export function want(s: FrameSlot): void {
  s.want = true;
  promote();
}

/** 离开预载区：只标记「不再需要」，槽位先留着（内容继续显示）；
 *  真正被回收发生在别处排队等不到槽位时（见 promote）——避免频繁卸载重载 */
export function release(s: FrameSlot): void {
  s.want = false;
  promote();
}

/** 距视口中心的归一化距离（越小越优先；已移出画面的给最大值） */
export function centerDistance(el: HTMLElement): number {
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return 1e6;
  const vh = window.innerHeight || 1;
  return Math.abs(r.top + r.height / 2 - vh / 2) / vh;
}
