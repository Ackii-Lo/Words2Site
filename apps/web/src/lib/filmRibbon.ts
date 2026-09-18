/**
 * 大屏「电影胶卷」几何库（B 方案，2026-09-18 定稿）。
 *
 * 模型：Catmull-Rom 中心线 + 沿线弧长采样 + 近远缩放系数 k。
 * k 同时控制带宽与卡片投影（近大远小），透视感来自 k 的近远比
 * （上带约 6:1），不是倾斜角。控制点数值与定稿效果图逐点一致，
 * 改数值前先出 1920×1080 对照图确认。
 *
 * 卡片贴合：HTML 卡片用单应变换（matrix3d）贴到带面上——
 * 四角精确落在带缘，剩余边中弧垂实测 ≤ 3.7px，被卡片 3px
 * 深色描边吸收（单仿射的角误差高达 28–39px，不可用）。
 */

export const HW = 143; // 带半宽（局部）＝卡片半高 117 ＋ 齿孔带 26
export const STRIDE = 178; // 卡片步长（局部）
export const PERF = 30; // 齿孔步长（局部）
export const CARD_W = 146; // 卡宽（局部，x ∈ [-73, 73]）
export const CARD_H = 234; // 卡高（局部，y ∈ [-117, 117]）
export const A0 = STRIDE * 0.52; // 卡片格点相位
export const SPEED = 7; // 桌面走带速度（局部单位/秒）—— Ackry 两轮反馈后定值
export const PHONE_SPEED = 7.5; // 手机走带速度（px/秒）

export const Y = "#F7D447";
export const K = "#1C1917";
export const CREAM = "#FAF7E8";
export const MONO = "Consolas,Menlo,monospace";
export const SANS =
  "-apple-system,'PingFang SC','Microsoft YaHei',Arial,sans-serif";

/** 控制点：[x, y, k]，k 为该处带宽缩放（prep 内钳制到 [0.22, 2.4]） */
export type Ctrl = ReadonlyArray<readonly [number, number, number]>;

export interface Pt {
  x: number;
  y: number;
  k: number;
  tx: number; // 单位切向
  ty: number;
  nx: number; // 单位法向
  ny: number;
  ls: number; // 按 k 归一的弧长（近处走 1 单位 ls，远处走得更远）
}

function catmull3(ctrl: Ctrl, per = 40): Pt[] {
  const P = [ctrl[0], ...ctrl, ctrl[ctrl.length - 1]];
  const F = (p0: number, p1: number, p2: number, p3: number, t: number) =>
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
  const out: Pt[] = [];
  for (let i = 0; i < P.length - 3; i++) {
    const [a, b, c, d] = [P[i], P[i + 1], P[i + 2], P[i + 3]];
    for (let j = 0; j < per; j++) {
      const t = j / per;
      out.push({
        x: F(a[0], b[0], c[0], d[0], t),
        y: F(a[1], b[1], c[1], d[1], t),
        k: F(a[2], b[2], c[2], d[2], t),
        tx: 0,
        ty: 0,
        nx: 0,
        ny: 0,
        ls: 0,
      });
    }
  }
  const L = ctrl[ctrl.length - 1];
  out.push({ x: L[0], y: L[1], k: L[2], tx: 0, ty: 0, nx: 0, ny: 0, ls: 0 });
  return out;
}

function prep(pts: Pt[]): Pt[] {
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    const tx = b.x - a.x;
    const ty = b.y - a.y;
    const L = Math.hypot(tx, ty) || 1;
    pts[i].tx = tx / L;
    pts[i].ty = ty / L;
    pts[i].nx = -ty / L;
    pts[i].ny = tx / L;
    pts[i].k = Math.max(0.22, Math.min(2.4, pts[i].k));
  }
  pts[0].ls = 0;
  for (let i = 1; i < pts.length; i++) {
    pts[i].ls =
      pts[i - 1].ls +
      Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y) /
        ((pts[i].k + pts[i - 1].k) / 2);
  }
  return pts;
}

export function atLs(P: Pt[], l: number): Pt {
  let lo = 0;
  let hi = P.length - 1;
  while (lo < hi - 1) {
    const m = (lo + hi) >> 1;
    if (P[m].ls <= l) lo = m;
    else hi = m;
  }
  const a = P[lo];
  const b = P[hi];
  const f = Math.max(0, Math.min(1, (l - a.ls) / (b.ls - a.ls || 1)));
  const p: Pt = {
    x: a.x + (b.x - a.x) * f,
    y: a.y + (b.y - a.y) * f,
    k: a.k + (b.k - a.k) * f,
    nx: a.nx + (b.nx - a.nx) * f,
    ny: a.ny + (b.ny - a.ny) * f,
    tx: a.tx + (b.tx - a.tx) * f,
    ty: a.ty + (b.ty - a.ty) * f,
    ls: l,
  };
  const nl = Math.hypot(p.nx, p.ny) || 1;
  const tl = Math.hypot(p.tx, p.ty) || 1;
  p.nx /= nl;
  p.ny /= nl;
  p.tx /= tl;
  p.ty /= tl;
  return p;
}

/**
 * 刚体旋转：以 (px, py) 为支点转整条带的控制点。
 * 「下压/上提」的正确语义＝绕不动端旋转（保持曲率），不是改控制点 y。
 */
function rotAbout(ctrl: Ctrl, px: number, py: number, deg: number): Ctrl {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return ctrl.map(([x, y, k]) => {
    const dx = x - px;
    const dy = y - py;
    return [px + dx * c - dy * s, py + dx * s + dy * c, k] as const;
  });
}

export interface Band {
  P: Pt[];
  Lmax: number;
  kmin: number;
  kmax: number;
  floor: number; // 近端压暗下限
  dimMax: number; // 远端压暗上限
  /** 带体静态 SVG（含暗部渐变与上下边线） */
  body: string;
}

export function buildBand(
  ctrl: Ctrl,
  o: { gid: string; nearLeft: boolean; floor: number; dimMax: number },
): Band {
  const P = prep(catmull3(ctrl));
  const Lmax = P[P.length - 1].ls;
  const ks = P.map((p) => p.k);
  const kmin = Math.min(...ks);
  const kmax = Math.max(...ks);
  const edge = (p: Pt, s: number) => ({
    x: p.x + p.nx * HW * p.k * s,
    y: p.y + p.ny * HW * p.k * s,
  });
  const STEP = Lmax / 160;
  const bpts: Pt[] = [];
  for (let l = 0; l <= Lmax + 1e-6; l += STEP)
    bpts.push(atLs(P, Math.min(l, Lmax)));
  let up = "";
  let dn = "";
  bpts.forEach((p, i) => {
    const e = edge(p, 1);
    up += (i ? " L " : "M ") + e.x.toFixed(1) + " " + e.y.toFixed(1);
  });
  for (let i = bpts.length - 1; i >= 0; i--) {
    const e = edge(bpts[i], -1);
    dn += " L " + e.x.toFixed(1) + " " + e.y.toFixed(1);
  }
  // 远端压暗：沿带身的线性渐变（近端 floor、远端 dimMax）
  const gx = o.nearLeft
    ? [bpts[0].x, bpts[bpts.length - 1].x]
    : [bpts[bpts.length - 1].x, bpts[0].x];
  const body =
    `<defs><linearGradient id="dg${o.gid}" gradientUnits="userSpaceOnUse" x1="${gx[0].toFixed(0)}" y1="0" x2="${gx[1].toFixed(0)}" y2="0">` +
    `<stop offset="0" stop-color="#100E0C" stop-opacity="${o.floor}"/><stop offset="1" stop-color="#100E0C" stop-opacity="${o.dimMax}"/></linearGradient></defs>` +
    `<path d="${up + dn} Z" fill="#33302B"/>` +
    `<path d="${up + dn} Z" fill="url(#dg${o.gid})"/>` +
    `<path d="${up}" fill="none" stroke="rgba(247,212,71,.40)" stroke-width="1.5"/>` +
    `<path d="M ${dn.slice(3)}" fill="none" stroke="rgba(247,212,71,.40)" stroke-width="1.5"/>`;
  return { P, Lmax, kmin, kmax, floor: o.floor, dimMax: o.dimMax, body };
}

export function norm(band: Band, k: number): number {
  return (k - band.kmin) / (band.kmax - band.kmin || 1);
}

/** 齿孔（动态）：给定相位返回本帧齿孔 SVG。屏外不生成。 */
export function holesAt(band: Band, phase: number): string {
  const P0 = PERF * 0.58;
  let s = "";
  for (
    let n = Math.ceil((26 - P0 - phase) / PERF);
    P0 + n * PERF + phase <= band.Lmax - 26;
    n++
  ) {
    const l = P0 + n * PERF + phase;
    const p = atLs(band.P, l);
    if (p.x < -260 || p.x > 2180) continue;
    const ang = (Math.atan2(p.ty, p.tx) * 180) / Math.PI;
    const op = (0.42 + 0.58 * norm(band, p.k)).toFixed(2);
    const off = (HW - 13) * p.k;
    for (const sx of [1, -1]) {
      const c = {
        x: p.x + p.nx * off * sx,
        y: p.y + p.ny * off * sx,
      };
      s +=
        `<g transform="translate(${c.x.toFixed(1)} ${c.y.toFixed(1)}) rotate(${ang.toFixed(2)}) scale(${p.k.toFixed(3)})" opacity="${op}">` +
        `<rect x="-8" y="-5.5" width="16" height="11" rx="2.4" fill="${Y}"/></g>`;
    }
  }
  return s;
}

/**
 * 卡片四角（屏幕坐标），顺序对应设计局部
 * (-73,-117) (73,-117) (73,117) (-73,117)。
 */
export function cardQuad(
  band: Band,
  l: number,
): [[number, number], [number, number], [number, number], [number, number]] {
  const map = (x: number, y: number): [number, number] => {
    const q = atLs(band.P, l + x);
    const off = y * q.k;
    return [q.x + q.nx * off, q.y + q.ny * off];
  };
  return [map(-73, -117), map(73, -117), map(73, 117), map(-73, 117)];
}

/** 解单位方形 → 四边形的单应（8 参数）。 */
export function homography(
  quad: ReadonlyArray<readonly [number, number]>,
): number[] {
  const src = [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ];
  const rows: number[][] = [];
  const v: number[] = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i];
    const [X, Y] = quad[i];
    rows.push([x, y, 1, 0, 0, 0, -X * x, -X * y]);
    v.push(X);
    rows.push([0, 0, 0, x, y, 1, -Y * x, -Y * y]);
    v.push(Y);
  }
  // 高斯消元（带列主元）
  const n = 8;
  const A = rows.map((r, i) => [...r, v[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++)
      if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = A[r][c] / A[c][c];
      for (let k = c; k <= n; k++) A[r][k] -= f * A[c][k];
    }
  }
  return A.map((r, i) => r[n] / r[i]);
}

/**
 * 单应参数 → CSS matrix3d（像素空间）。
 * h 定义在单位方形上：X = (h0·u + h1·v + h2) / (h6·u + h7·v + 1)。
 * 卡片元素尺寸 w × hgt（像素）、transform-origin: 0 0，
 * 故 u = x / w、v = y / hgt，通分后得到下面的系数。
 */
export function matrix3d(h: number[], w: number, hgt: number): string {
  const m = [
    h[0] * hgt,
    h[3] * hgt,
    0,
    h[6] * hgt,
    h[1] * w,
    h[4] * w,
    0,
    h[7] * w,
    0,
    0,
    1,
    0,
    h[2] * w * hgt,
    h[5] * w * hgt,
    0,
    w * hgt,
  ];
  return `matrix3d(${m.map((v) => v.toFixed(2)).join(",")})`;
}

/** 带上落在屏幕 [x0, x1] 内的弧长范围（中心线 x 单调递增） */
export function lRange(band: Band, x0: number, x1: number): [number, number] {
  let l0 = 0;
  let l1 = band.Lmax;
  for (const p of band.P) {
    if (p.x >= x0) {
      l0 = p.ls;
      break;
    }
  }
  for (let i = band.P.length - 1; i >= 0; i--) {
    if (band.P[i].x <= x1) {
      l1 = band.P[i].ls;
      break;
    }
  }
  return [l0, l1];
}

// ---------------- 定稿控制点（与效果图逐点一致） ----------------

/** 上带（主）：左近右远。基线斜率递减（近陡远平）＝透视收缩；绕左支点下压 1.65°、远端微翘、中段偏左微拱 */
export const RIBBON_A: Ctrl = (() => {
  const base = (
    [
      [-320, 810, 1.95],
      [350, 578, 1.4],
      [950, 392, 0.98],
      [1550, 228, 0.7],
      [2100, 95, 0.46],
      [2600, 10, 0.32],
    ] as const
  ).map(([x, y, k]) => [x, y, k * 1.15] as const);
  const c = rotAbout(base, -320, 810, 1.65);
  const pts = c.map((p) => [...p] as [number, number, number]);
  pts[4][1] -= 3;
  pts[5][1] -= 10;
  pts[2][1] -= 8;
  pts[3][1] -= 3;
  return pts;
})();

/** 下带（主）：左远右近（近端沉到画面外底）。绕右支点上提 0.85° */
export const RIBBON_B: Ctrl = rotAbout(
  [
    [-450, 1050, 0.36],
    [100, 940, 0.46],
    [600, 845, 0.6],
    [1100, 790, 0.8],
    [1550, 755, 1.1],
    [1950, 730, 1.5],
    [2400, 715, 1.95],
    [2900, 700, 2.0],
  ],
  2900,
  700,
  0.85,
);

/** 背景虚化空胶卷（斜率各异、互相交错） */
const GHOSTS: Ctrl[] = [
  [
    [-350, 480, 0.66],
    [400, 330, 0.56],
    [1150, 210, 0.47],
    [1900, 100, 0.4],
    [2600, 30, 0.34],
  ],
  [
    [-350, 560, 0.5],
    [400, 630, 0.46],
    [1000, 690, 0.42],
    [1700, 750, 0.38],
    [2600, 830, 0.34],
  ],
  [
    [700, 560, 0.4],
    [1400, 460, 0.36],
    [2100, 390, 0.32],
    [2800, 330, 0.28],
  ],
];

function ghostRibbon(ctrl: Ctrl, maxPerf = 160): string {
  const P = prep(catmull3(ctrl));
  const Lmax = P[P.length - 1].ls;
  const edge = (p: Pt, s: number) => ({
    x: p.x + p.nx * HW * p.k * s,
    y: p.y + p.ny * HW * p.k * s,
  });
  const STEP = Lmax / 110;
  const pts: Pt[] = [];
  for (let l = 0; l <= Lmax + 1e-6; l += STEP)
    pts.push(atLs(P, Math.min(l, Lmax)));
  let up = "";
  let dn = "";
  pts.forEach((p, i) => {
    const e = edge(p, 1);
    up += (i ? " L " : "M ") + e.x.toFixed(1) + " " + e.y.toFixed(1);
  });
  for (let i = pts.length - 1; i >= 0; i--) {
    const e = edge(pts[i], -1);
    dn += " L " + e.x.toFixed(1) + " " + e.y.toFixed(1);
  }
  let s = `<path d="${up + dn} Z" fill="#2E2B26" opacity=".8"/>`;
  s += `<path d="${up}" fill="none" stroke="rgba(247,212,71,.22)" stroke-width="1.2"/>`;
  s += `<path d="M ${dn.slice(3)}" fill="none" stroke="rgba(247,212,71,.22)" stroke-width="1.2"/>`;
  for (let l = PERF * 1.2, n = 0; l < Lmax && n < maxPerf; l += PERF * 2, n++) {
    const p = atLs(P, l);
    if (p.x < -260 || p.x > 2180) continue;
    const ang = (Math.atan2(p.ty, p.tx) * 180) / Math.PI;
    const off = (HW - 13) * p.k;
    for (const sx of [1, -1]) {
      const c = {
        x: p.x + p.nx * off * sx,
        y: p.y + p.ny * off * sx,
      };
      s +=
        `<g transform="translate(${c.x.toFixed(1)} ${c.y.toFixed(1)}) rotate(${ang.toFixed(2)}) scale(${p.k.toFixed(3)})" opacity=".34">` +
        `<rect x="-8" y="-5.5" width="16" height="11" rx="2.4" fill="${Y}"/></g>`;
    }
  }
  return s;
}

/** 背景层：虚线网格 + 分界线 + 三条虚化空胶卷（两端渐隐） */
export function ghostMarkup(): string {
  const W = 1920;
  const H = 1080;
  let bg = `<rect width="${W}" height="${H}" fill="${K}"/>`;
  bg += `<g stroke="rgba(247,212,71,.09)" stroke-width="2" stroke-dasharray="3 8">`;
  for (let x = W / 4; x < W - 1; x += W / 4)
    bg += `<line x1="${x.toFixed(0)}" y1="0" x2="${x.toFixed(0)}" y2="${H}"/>`;
  for (let y = H / 3; y < H - 1; y += H / 3)
    bg += `<line x1="0" y1="${y.toFixed(0)}" x2="${W}" y2="${y.toFixed(0)}"/>`;
  bg += `</g>`;
  // 虚线分界画在胶卷图层下面（横穿胶片会切坏带面）
  bg += `<line x1="0" y1="288" x2="${W}" y2="288" stroke="rgba(247,212,71,.42)" stroke-width="2.5" stroke-dasharray="10 8"/>`;
  bg += `<line x1="1420" y1="948" x2="${W - 56}" y2="948" stroke="rgba(247,212,71,.28)" stroke-width="1.5" stroke-dasharray="6 6"/>`;
  const ghost =
    `<defs><linearGradient id="w2sgf" x1="0" y1="0" x2="1" y2="0">` +
    `<stop offset="0" stop-color="#000"/><stop offset=".04" stop-color="#fff"/><stop offset=".93" stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient>` +
    `<mask id="w2sgm" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="url(#w2sgf)"/></mask>` +
    `<filter id="w2sblur" x="-15%" y="-15%" width="130%" height="130%"><feGaussianBlur stdDeviation="3"/></filter></defs>` +
    `<g mask="url(#w2sgm)"><g filter="url(#w2sblur)" opacity=".62">` +
    GHOSTS.map((c) => ghostRibbon(c)).join("") +
    `</g></g>`;
  return bg + ghost;
}

// ---------------- CPU logo（真矢量，逐字取自品牌源文件） ----------------

const P1 =
  "M19.48,13.51c.5-6.74-.64-7.9-.66-7.9C18.94,1.59,16.12.04,16.14.01c-.09,2.96-1.57,3.15-2.05,3.31s-6.23-.23-8.18.94c-1.39.77-1.72.88-1.91.87-.99-.03-2.12-1.57-2.12-1.57h-.14l.03,1.67s-.57.07-.94,0c0,.4.78,1.37.84,1.39-.3.69-.33,2.52.28,6.75.02.02.03.14-.14.21-.8.02-1.37.76-1.43.84-.05.08-.21.97-.21.97,0,0,.24.41.63.49.17.08.28.7.28.7l-.03,2.26s.12.5.42.87c.29.37.73.52.73.52l6.13.03s.4-.06.8-.35.42-.87.42-.87l-.03-2.26h-.84l-.03,2.02s-.03.18-.17.31c-.13.12-.49.21-.49.21,0,0-3.42.12-5.31-.04-.1,0-.56-.13-.64-.48s.07-4,.07-4l.45-.28,5.6.03s.38.07.45.35-.12,1.12.38,1.15c.23.04.66-.28.66-.28,0,0,.16-1.42-.03-1.84-.14-.23-.68-.24-1.39-.35s-5.4-.03-5.36-.07c-.42-2.02.94-2.19.94-2.19,0,0-.24-2.11.31-2.51,1.84-.26,3.86-.85,6.72,1.04.16-.17.68-.8,1.01-.7.75.19,3.67.71,5.46-.28.26-.08.35.35.35.35,0,0,.12,2.17.14,2.19.64,0,.87,1.04.87,1.04,0,0-.07,2.03-.03,2.05.66-.03.8.42.8.42,0,0,.09,3.79.03,3.97s-.38.35-.38.35c0,0-5.45.15-5.78.03s-.45-.45-.45-.45v-5.12l-1.01.38s.02,4.79.07,5.01c0,0,.05.5.31.77s.49.33.66.42,5.48.05,5.99,0c.33-.05.68-.16,1.08-.56s.49-.91.49-.91v-2.51s.82-.99.84-1.15c.14-1.29-1.76-1.72-1.78-1.67l-.03.03ZM15.37,6.75l.52.1s-.63.7-2.33.91c-.85.05-8.18-1.18-8.7-1.04-.03-.02-.43.48-.42.49-2.18.81-2.19,2.19-2.19,2.19-.3-2.72.8-3.13,1.18-3.27s.77-.03.97-.07c2.24-1.61,4.18-1.32,4.18-1.32,0,0,.33.28.35.28.37-.01,1.24-.02,3.45-.14s3.82-.18,4.49-2.33c1.04,3.02-1.5,4.21-1.5,4.21h0Z";
const P2 =
  "M9.77,18.37v-3.07h.63v3.07h-.63ZM10.08,17.41v-.51h.51c.14,0,.25-.04.31-.13s.1-.22.1-.41h0c0-.19-.03-.33-.1-.42-.07-.09-.17-.13-.31-.13h-.52v-.51h.63c.2,0,.37.04.51.13s.25.21.32.36c.07.16.11.34.11.56h0c0,.22-.04.41-.11.56-.07.16-.18.28-.32.36-.14.09-.31.13-.51.13h-.63.01Z";

export function mark(x: number, y: number, w: number, ink = Y): string {
  const s = (w / 22.84).toFixed(5);
  return `<g transform="translate(${x} ${y}) scale(${s})" fill="${ink}" fill-rule="evenodd"><path d="${P1}"/><path d="${P2}"/></g>`;
}

// ---------------- 桌面品牌头/底（与定稿效果图一致） ----------------

const HALO = `paint-order="stroke" stroke="${K}" stroke-width="5" stroke-linejoin="round"`;

/** 标题区（画在胶卷之上：胶片可压进标题区，标题优先） */
export function headDesk(liveCount: number, demoCount: number): string {
  const W = 1920;
  let s = `<text x="56" y="132" font-size="126" font-weight="900" letter-spacing="3" fill="none" stroke="${Y}" stroke-width="3.5">WORDS TO WEBSITE</text>`;
  s += `<text x="56" y="241" font-size="60" font-weight="900" fill="${Y}">01</text>`;
  s += `<rect x="146" y="206" width="152" height="34" rx="17" fill="none" stroke="${Y}" stroke-width="1.5"/>`;
  s += `<text x="222" y="228" text-anchor="middle" font-size="14" letter-spacing="1" fill="${Y}">现场大屏 · 投影</text>`;
  s += `<text x="322" y="228" font-size="15" fill="${CREAM}">已上线 </text>`;
  s += `<text x="368" y="228" font-family="${MONO}" font-size="15" font-weight="700" fill="${Y}">${liveCount}</text>`;
  s += `<text x="382" y="228" font-size="15" fill="${CREAM}"> 个网页</text>`;
  s += `<text x="560" y="228" font-family="${MONO}" font-size="13" letter-spacing="1" fill="rgba(247,212,71,.72)">ROLL 01 · 35MM</text>`;
  s += `<text x="${W - 56}" y="60" text-anchor="end" font-family="${MONO}" font-size="13" letter-spacing="1" fill="rgba(247,212,71,.85)" ${HALO}>SHEET 01 · SCALE 1:1</text>`;
  if (demoCount > 0) {
    s += `<rect x="${W - 184}" y="76" width="128" height="26" rx="4" fill="${Y}"/>`;
    s += `<text x="${W - 120}" y="93.5" text-anchor="middle" font-family="${MONO}" font-size="12.5" font-weight="700" fill="${K}">演示模式 ×${demoCount}</text>`;
  }
  return s;
}

/** 右下角厂牌锁版 */
export function footDesk(count: number): string {
  const W = 1920;
  const shots = String(Math.max(0, count)).padStart(2, "0");
  let s = `<text x="${W - 56}" y="934" text-anchor="end" font-family="${MONO}" font-size="12.5" letter-spacing="1.2" fill="rgba(247,212,71,.55)">${shots} EXPOSURES · 35MM · LOOP</text>`;
  s += mark(1470, 972, 84);
  s += `<text x="1564" y="1010" font-size="20" font-weight="900" fill="${CREAM}">Computer Psycho Union</text>`;
  s += `<text x="1564" y="1034" font-size="11.5" font-weight="700" fill="rgba(250,247,232,.72)">The University of Nottingham Ningbo China</text>`;
  return s;
}

// ---------------- 手机品牌头/底 ----------------

export function headPhone(): string {
  const W = 375;
  const halo = `paint-order="stroke" stroke="${K}" stroke-width="4.5" stroke-linejoin="round"`;
  let s = `<text x="22" y="50" font-size="31" font-weight="900" letter-spacing="1" fill="none" stroke="${Y}" stroke-width="1.8">WORDS TO WEBSITE</text>`;
  s += `<text x="22" y="74" font-family="${MONO}" font-size="9.5" letter-spacing="1" fill="rgba(247,212,71,.72)" ${halo}>ROLL 01 · 35MM</text>`;
  s += `<text x="${W - 22}" y="74" text-anchor="end" font-family="${MONO}" font-size="9.5" letter-spacing="1" fill="rgba(247,212,71,.72)" ${halo}>SCALE 1:1</text>`;
  return s;
}

export function footPhone(demoCount: number): string {
  const W = 375;
  const H = 812;
  let s = `<rect x="0" y="${H - 92}" width="${W}" height="92" fill="rgba(28,25,23,.92)"/>`;
  s += mark(20, H - 74, 48);
  s += `<text x="78" y="${H - 52}" font-size="12.5" font-weight="900" fill="${CREAM}">Computer Psycho Union</text>`;
  s += `<text x="78" y="${H - 37}" font-size="7.5" font-weight="700" fill="rgba(250,247,232,.62)">The University of Nottingham Ningbo China</text>`;
  if (demoCount > 0) {
    s += `<rect x="${W - 124}" y="${H - 46}" width="102" height="21" rx="4" fill="${Y}"/>`;
    s += `<text x="${W - 73}" y="${H - 32}" text-anchor="middle" font-family="${MONO}" font-size="10" font-weight="700" fill="${K}">演示模式 ×${demoCount}</text>`;
  }
  return s;
}

/** 手机背景层：网格 + 标题线 */
export function bgPhone(): string {
  const W = 375;
  const H = 812;
  let s = `<rect width="${W}" height="${H}" fill="${K}"/>`;
  s += `<g stroke="rgba(247,212,71,.09)" stroke-width="2" stroke-dasharray="3 8">`;
  for (let x = W / 4; x < W - 1; x += W / 4)
    s += `<line x1="${x.toFixed(0)}" y1="0" x2="${x.toFixed(0)}" y2="${H}"/>`;
  for (let y = H / 3; y < H - 1; y += H / 3)
    s += `<line x1="0" y1="${y.toFixed(0)}" x2="${W}" y2="${y.toFixed(0)}"/>`;
  s += `</g>`;
  s += `<line x1="0" y1="88" x2="${W}" y2="88" stroke="rgba(247,212,71,.42)" stroke-width="1.5" stroke-dasharray="7 6"/>`;
  return s;
}

/**
 * 手机单列胶片条静态部分（带体拉通全屏 + 黄边线 + 可见段外「沉入暗部」渐变罩）。
 * yTop/yBot 只圈定可见卡片区；齿孔与卡片由组件层叠加上。
 */
export function phoneStripSvg(
  gid: string,
  cx: number,
  yTop: number,
  yBot: number,
): string {
  const H = 812;
  const L = cx - PHW;
  const BW = (PHW * 2).toFixed(1);
  let s = `<rect x="${L.toFixed(1)}" y="0" width="${BW}" height="${H}" fill="#33302B"/>`;
  s += `<rect x="${L.toFixed(1)}" y="0" width="${BW}" height="${H}" fill="none" stroke="rgba(247,212,71,.40)" stroke-width="1.5"/>`;
  s +=
    `<defs><linearGradient id="pt${gid}" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${K}"/><stop offset=".55" stop-color="${K}" stop-opacity=".45"/><stop offset="1" stop-color="${K}" stop-opacity="0"/></linearGradient>` +
    `<linearGradient id="pb${gid}" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${K}" stop-opacity="0"/><stop offset=".45" stop-color="${K}" stop-opacity=".45"/><stop offset="1" stop-color="${K}"/></linearGradient></defs>`;
  s += `<rect x="${L.toFixed(1)}" y="0" width="${BW}" height="${yTop}" fill="url(#pt${gid})"/>`;
  s += `<rect x="${L.toFixed(1)}" y="${yBot}" width="${BW}" height="${(H - yBot).toFixed(1)}" fill="url(#pb${gid})"/>`;
  return s;
}

// ---------------- 手机竖排双列参数（定稿） ----------------

export const PHONE = {
  W: 375,
  H: 812,
  TOP: 88, // 卡片区可用范围顶（标题线之下）
  BOT: 812 - 92, // 底栏之上
  PK: 0.808, // 卡片缩放
  PPERF: 18.5, // 齿孔步长
} as const;

/** 可见段长度：可用范围的 6/7（末段 1/7 为卡片淡出带） */
export const PLEN = Math.round((PHONE.BOT - PHONE.TOP) * (6 / 7));
/** 左列（沉底）：可见段贴可用范围底部；右列（贴顶）：贴顶部 */
export const PLEFT_Y: [number, number] = [PHONE.BOT - PLEN, PHONE.BOT];
export const PRIGHT_Y: [number, number] = [PHONE.TOP, PHONE.TOP + PLEN];

export const PCW = 146 * PHONE.PK; // 卡宽 ≈ 118
export const PCH = 234 * PHONE.PK; // 卡高 ≈ 189
export const PHW = 73 * PHONE.PK + 26 * PHONE.PK; // 列半宽 ≈ 80
export const PSTRIDE = PCH + 26 * PHONE.PK; // 卡片步长 ≈ 210

/** 手机齿孔贴片（data URI）：一个 PPERF 高的 tile，含左右两列孔 */
export const PERF_TILE = (() => {
  const pw = 12 * PHONE.PK;
  const ph = 8.2 * PHONE.PK;
  const rx = 2 * PHONE.PK;
  const w = PHW * 2;
  // 定稿：孔心到带心距离 = PHW - 10*PK（≈71.9），即孔心距带边约 8.1px，两列孔分别贴左右外缘
  const rc = PHW - 10 * PHONE.PK;
  const hx = [PHW - rc, PHW + rc];
  const hy = (PHONE.PPERF - pw) / 2;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w.toFixed(1)}" height="${PHONE.PPERF}">` +
    hx
      .map(
        (x) =>
          `<rect x="${(x - ph / 2).toFixed(1)}" y="${hy.toFixed(1)}" width="${ph.toFixed(1)}" height="${pw.toFixed(1)}" rx="${rx.toFixed(1)}" fill="#F7D447" fill-opacity=".72"/>`,
      )
      .join("") +
    `</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
})();
