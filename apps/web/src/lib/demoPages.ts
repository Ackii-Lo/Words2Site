/**
 * 大屏演示页生成器：/screen?demo=N 时填充 N 张模拟卡片（srcdoc）,
 * 用于压测滚动墙与活动前大屏预演，不依赖服务端数据。
 * 产物为自包含 HTML(无外链、无 emoji)，按模板参数生成多样化版式。
 *
 * 【重要】用户只输入文字，真实生成页里不存在自定义图片。
 * 所以这里不设任何图片占位（灰块 / 色块 / 占位条），
 * 页面 = 纯文字排版 + 一枚统一预设图案（见 ART）。
 */
import type { CardStyle } from "./styleHint";

/** 统一预设图案（形状固定，颜色跟随该页主题色） */
type ArtKey =
  | "cup"
  | "orbit"
  | "moon"
  | "ring"
  | "star"
  | "bars"
  | "wave"
  | "grid"
  | "steam"
  | "glyph";

interface DemoSpec {
  title: string;
  subtitle: string;
  tags: string[];
  bg: string; // CSS background
  ink: string; // 前景色
  accent: string; // 强调色
  layout: "hero" | "cards" | "split" | "stripes";
  /** 预设图案 */
  art: ArtKey;
  /** 真实文案行（替代原来的占位灰条） */
  lines: string[];
  /** art = glyph 时显示的方块字 */
  glyph?: string;
  /** 真实分类跑出来偏中性，硬编码更稳定；按 SPEC 视觉特征挑 */
  styleHint: CardStyle;
}

const SPECS: DemoSpec[] = [
  {
    title: "猫咪图鉴",
    subtitle: "三花 · 布偶 · 橘猫档案",
    tags: ["宠物", "日常"],
    bg: "linear-gradient(160deg,#FF9EC4,#FF6E9C)",
    ink: "#FFFFFF",
    accent: "#FFE3EE",
    layout: "cards",
    art: "star",
    lines: ["三花 · 布偶 · 橘猫", "领养日记 每日更新", "相册与健康档案"],
    styleHint: "bubble", // 06 泡泡：可爱主题
  },
  {
    title: "深空观测站",
    subtitle: "今晚的星象与观测计划",
    tags: ["天文", "夜观"],
    bg: "radial-gradient(120% 100% at 20% 0%,#1B2A6B 0%,#0A1030 70%)",
    ink: "#E7ECFF",
    accent: "#8FA6FF",
    layout: "hero",
    art: "orbit",
    lines: ["22:40 木星合月", "23:10 英仙座流星雨", "00:30 深空摄影"],
    styleHint: "fullscreen", // 02 满幕：深色铺满
  },
  {
    title: "手冲咖啡笔记",
    subtitle: "耶加雪菲 · 水温 92°C",
    tags: ["咖啡", "冲煮"],
    bg: "linear-gradient(180deg,#4A2F1D,#2B1A0F)",
    ink: "#F3E7D8",
    accent: "#D8A25E",
    layout: "stripes",
    art: "cup",
    lines: [
      "15g 粉 · 1:16 · 92°C",
      "闷蒸 30 秒后三段注水",
      "总时长 2 分 30 秒",
    ],
    styleHint: "archive", // 01 档案：米纸衬底
  },
  {
    title: "水墨江南",
    subtitle: "小桥 流水 人家",
    tags: ["旅行", "风景"],
    bg: "linear-gradient(180deg,#F5F2EA,#E4DECE)",
    ink: "#2B2B26",
    accent: "#8C3B2E",
    layout: "split",
    art: "moon",
    lines: ["乌镇 · 西塘 · 南浔", "雨天走青石板路", "三天两夜慢行"],
    styleHint: "spine", // 03 书脊：文艺 / 档案标签感
  },
  {
    title: "节奏实验室",
    subtitle: "校园乐队排练实录",
    tags: ["音乐", "现场"],
    bg: "linear-gradient(135deg,#12002E,#4B0A6B)",
    ink: "#F4E9FF",
    accent: "#FF5ED2",
    layout: "stripes",
    art: "bars",
    lines: [
      "吉他 张野 · 贝斯 阿哲",
      "鼓 小满 · 键盘 丁丁",
      "每周四 19:00 排练",
    ],
    styleHint: "bigno", // 04 巨号：出血大序号
  },
  {
    title: "火锅研究所",
    subtitle: "麻辣锅底风味曲线",
    tags: ["美食", "研究"],
    bg: "linear-gradient(160deg,#C43A1C,#7A1B08)",
    ink: "#FFF2E8",
    accent: "#FFC53D",
    layout: "cards",
    art: "ring",
    lines: ["牛油锅底 32 味", "麻辣度 8.5 / 10", "人均 78 元"],
    styleHint: "collage", // 05 拼贴：手作感
  },
  {
    title: "绿茵战报",
    subtitle: "赛季数据与赛程速览",
    tags: ["足球", "数据"],
    bg: "linear-gradient(180deg,#0B3D2C,#06281C)",
    ink: "#E6F5EC",
    accent: "#57D9A3",
    layout: "split",
    art: "grid",
    lines: ["近五轮 3 胜 1 平", "主场连续 7 场不败", "下轮 客战 理工学院"],
    styleHint: "collage", // 05 拼贴
  },
  {
    title: "生日快乐",
    subtitle: "给九月的小寿星",
    tags: ["祝福", "派对"],
    bg: "linear-gradient(135deg,#FFD98E,#FF9E7A)",
    ink: "#5A2A1A",
    accent: "#FFFFFF",
    layout: "hero",
    art: "glyph",
    glyph: "乐",
    lines: ["九月的第三个周六", "学生活动中心 2F", "带上你的祝福就好"],
    styleHint: "bubble", // 06 泡泡
  },
  {
    title: "海边邮局",
    subtitle: "慢递一封明信片",
    tags: ["文创", "海岸"],
    bg: "linear-gradient(180deg,#9FE2E8,#2E7DA8)",
    ink: "#FFFFFF",
    accent: "#FFE9B8",
    layout: "cards",
    art: "glyph",
    glyph: "拾",
    lines: ["慢递 · 一年后寄出", "手写卡片 免费领取", "盖当日灯塔邮戳"],
    styleHint: "classic", // 07 典雅：博物馆展签
  },
  {
    title: "旧书地下室",
    subtitle: "绝版书交换计划",
    tags: ["读书", "交换"],
    bg: "linear-gradient(160deg,#3E3A33,#211E19)",
    ink: "#EFE9DC",
    accent: "#C9B458",
    layout: "stripes",
    art: "glyph",
    glyph: "书",
    lines: ["一本换一本 不收押金", "每周三 18:00 开箱", "已流通 216 册"],
    styleHint: "spine", // 03 书脊
  },
  {
    title: "水族馆夜场",
    subtitle: "发光水母与深海走廊",
    tags: ["海洋", "夜场"],
    bg: "radial-gradient(110% 90% at 50% 10%,#0E4B66,#041E2E)",
    ink: "#DFF6FF",
    accent: "#4FD8EB",
    layout: "hero",
    art: "wave",
    lines: ["发光水母特展", "深海走廊 20:30 开放", "夜场票 58 元"],
    styleHint: "fullscreen", // 02 满幕
  },
  {
    title: "拉面地图",
    subtitle: "豚骨 酱油 味噌 三大流派",
    tags: ["探店", "地图"],
    bg: "linear-gradient(180deg,#F28C3D,#C2511F)",
    ink: "#FFF6EC",
    accent: "#3B2415",
    layout: "split",
    art: "steam",
    lines: ["豚骨 · 酱油 · 味噌", "已打卡 12 家", "汤头浓度评分榜"],
    styleHint: "collage", // 05 拼贴
  },
];

/**
 * 基准设计宽度：demo 页按 390px 移动页设计（下面所有数值原本都是该宽度下的 px）。
 * 卡片里的 iframe 只有 120–145px 宽，直接沿用 px 会让标题、间距整体溢出被裁 ——
 * 所以统一改写成 vw（相对 iframe 宽度），任意卡片尺寸下都能等比落在框内。
 */
const BASE_W = 390;
const v = (px: number): string => `${+(px / (BASE_W / 100)).toFixed(3)}vw`;

function esc(s: string): string {
  return s.replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!,
  );
}

const svg = (inner: string): string =>
  `<svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" fill="none">${inner}</svg>`;

/**
 * 统一图案库：全部为纯矢量描边/填充图形（不是图片、不是占位框）。
 * 颜色跟随该页主题色，glyph 用品牌黄黑以保证可读。
 */
const ART: Record<ArtKey, (spec: DemoSpec) => string> = {
  // 咖啡杯
  cup: (s) =>
    svg(`<g stroke="${s.accent}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round">
      <path d="M32 26c0-5 7-5 7-11M50 26c0-5 7-5 7-11"/>
      <path d="M22 40h46v22a16 16 0 0 1-16 16H38a16 16 0 0 1-16-16z"/>
      <path d="M68 47h6a9 9 0 0 1 0 18h-6"/>
    </g>`),
  // 深空星图：同心圆 + 准星 + 点阵
  orbit: (s) =>
    svg(`<g stroke="${s.accent}" fill="none">
      <circle cx="48" cy="52" r="34" stroke-width="1.6" opacity=".5"/>
      <circle cx="48" cy="52" r="21" stroke-width="2" opacity=".8"/>
      <path d="M48 6v13M48 85v13M4 52h13M79 52h13" stroke-width="2.4" stroke-linecap="round"/>
    </g>
    <circle cx="48" cy="52" r="7" fill="${s.accent}"/>
    <g fill="${s.accent}" opacity=".75">
      <circle cx="88" cy="14" r="2.4"/><circle cx="94" cy="22" r="2.4"/><circle cx="86" cy="30" r="2.4"/>
      <circle cx="94" cy="38" r="2.4"/><circle cx="85" cy="46" r="2.4"/>
    </g>`),
  // 大圆 + 小圆（水墨留白）
  moon: (s) =>
    svg(`<circle cx="46" cy="54" r="31" fill="${s.ink}" opacity=".82"/>
    <circle cx="76" cy="26" r="8" fill="${s.ink}" opacity=".35"/>`),
  // 白描圆环
  ring: (s) =>
    svg(
      `<circle cx="50" cy="50" r="33" stroke="${s.accent}" stroke-width="6.5" fill="none"/>`,
    ),
  // 五角星
  star: (s) =>
    svg(
      `<path d="M50 6 61.2 39.1 96 39.1 67.9 59.3 79.1 92.4 50 72.2 20.9 92.4 32.1 59.3 4 39.1 38.8 39.1Z" fill="${s.accent}"/>`,
    ),
  // 均衡器音轨
  bars: (s) =>
    svg(`<g fill="${s.accent}" rx="4">
      <rect x="10" y="52" width="10" height="38" rx="5" opacity=".45"/>
      <rect x="27" y="34" width="10" height="56" rx="5" opacity=".7"/>
      <rect x="44" y="16" width="10" height="74" rx="5"/>
      <rect x="61" y="42" width="10" height="48" rx="5" opacity=".7"/>
      <rect x="78" y="58" width="10" height="32" rx="5" opacity=".45"/>
    </g>`),
  // 水波
  wave: (s) =>
    svg(`<g stroke="${s.accent}" stroke-width="3.6" fill="none" stroke-linecap="round">
      <path d="M6 34c12-13 24-13 36 0s24 13 36 0" opacity=".55"/>
      <path d="M6 54c12-13 24-13 36 0s24 13 36 0"/>
      <path d="M6 74c12-13 24-13 36 0s24 13 36 0" opacity=".55"/>
    </g>`),
  // 点阵
  grid: (s) =>
    svg(`<g fill="${s.accent}">
      ${Array.from({ length: 5 }, (_, r) =>
        Array.from(
          { length: 5 },
          (_, c) =>
            `<circle cx="${18 + c * 16}" cy="${18 + r * 16}" r="${2.2 + ((r * 5 + c) % 3) * 0.9}"/>`,
        ).join(""),
      ).join("")}
    </g>`),
  // 蒸汽
  steam: (s) =>
    svg(`<g stroke="${s.accent}" stroke-width="5" fill="none" stroke-linecap="round">
      <path d="M24 84c0-16 12-16 12-32S24 36 24 20" opacity=".5"/>
      <path d="M50 84c0-16 12-16 12-32S50 36 50 20"/>
      <path d="M76 84c0-16 12-16 12-32S76 36 76 20" opacity=".5"/>
    </g>`),
  // 方块字：品牌黄底 + 近黑字，全站统一
  glyph: (s) =>
    `<div style="width:100%;height:100%;display:grid;place-items:center">
      <div style="width:82%;aspect-ratio:1;background:#F7D447;border-radius:14%;display:grid;place-items:center">
        <span style="font-size:${v(34)};font-weight:900;color:#1C1917;line-height:1">${esc(s.glyph ?? "字")}</span>
      </div>
    </div>`,
};

/** 真实文字行（替代原先的占位灰条） */
function textRows(spec: DemoSpec, style: "plain" | "blocked"): string {
  const lines = style === "blocked" ? spec.lines : spec.lines.slice(0, 2);
  const rows = lines
    .map((l) =>
      style === "blocked"
        ? `<div style="width:100%;background:${spec.accent}1F;border-left:${v(3)} solid ${spec.accent};border-radius:${v(6)};padding:${v(6)} ${v(10)};font-size:${v(12)};line-height:1.35;text-align:left">${esc(l)}</div>`
        : `<div style="font-size:${v(12)};line-height:1.5;opacity:.82">${esc(l)}</div>`,
    )
    .join("");
  return `<div style="width:100%;display:flex;flex-direction:column;gap:${v(style === "blocked" ? 5 : 2)};align-items:center;margin-top:${v(2)}">${rows}</div>`;
}

/**
 * 页面正文：居中构图（图案 → 标题 → 副标题 → 短强调线 → 文字行 → 主题词）。
 * 用户只输入文字，生成页里不存在自定义图片，因此不放任何图片占位；
 * 图案一律取自上面的 ART 统一图案库。内容垂直居中铺满，
 * 避免下半部空出一块（那会看着像"待填图片位"）。
 */
function body(spec: DemoSpec): string {
  const artW: Record<DemoSpec["layout"], number> = {
    hero: 30,
    split: 27,
    cards: 24,
    stripes: 24,
  };
  const blocked = spec.layout === "cards";
  return `
    <div style="flex:1;min-height:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 ${v(26)} ${v(14)}">
      <div style="width:${artW[spec.layout]}%;max-width:${v(108)};aspect-ratio:1;flex:0 0 auto">${ART[spec.art](spec)}</div>
      <div style="margin-top:${v(12)};font-size:${v(22)};font-weight:800;letter-spacing:${v(1.5)};line-height:1.3">${esc(spec.title)}</div>
      <div style="margin-top:${v(5)};font-size:${v(12)};line-height:1.45;opacity:.8">${esc(spec.subtitle)}</div>
      <div style="width:${v(32)};height:${v(2)};background:${spec.accent};opacity:.9;margin:${v(10)} 0 ${v(9)}"></div>
      ${textRows(spec, blocked ? "blocked" : "plain")}
      <div style="margin-top:${v(12)};font-family:'IBM Plex Mono',monospace;font-size:${v(10)};letter-spacing:${v(1.5)};opacity:.6">${esc(spec.tags.join(" · "))}</div>
    </div>`;
}

export function demoPage(index: number): string {
  const spec = SPECS[index % SPECS.length];
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  * { margin: 0; box-sizing: border-box; }
  html, body { height: 100%; }
  body { font-family: system-ui, -apple-system, "PingFang SC", sans-serif; background: ${spec.bg}; color: ${spec.ink}; display: flex; flex-direction: column; overflow: hidden; }
  header { flex: 0 0 auto; display: flex; justify-content: space-between; align-items: center; padding: ${v(12)} ${v(16)}; font-size: ${v(10)}; letter-spacing: ${v(2)}; opacity: .75; font-family: "IBM Plex Mono", monospace; }
</style></head>
<body>
  <header><span>WORDS2SITE</span><span>DEMO-${String(index + 1).padStart(2, "0")}</span></header>
  ${body(spec)}
</body></html>`;
}

/** 模拟条目（与真实条目同构） */
export function demoItems(count: number): Array<{
  taskId: string;
  code: string | null;
  domain: string | null;
  url: null;
  prompt: string;
  hasScreenshot: false;
  createdAt: number;
  demoIndex: number;
  styleHint: CardStyle;
}> {
  const names = [
    "cat",
    "space",
    "coffee",
    "ink",
    "beat",
    "hotpot",
    "pitch",
    "bday",
    "seamail",
    "books",
    "aqua",
    "ramen",
  ];
  return Array.from({ length: count }, (_, i) => {
    const k = i % SPECS.length;
    return {
      taskId: `demo-${i}`,
      code: `W2S-${(1000 + i * 137).toString(36).toUpperCase().slice(-4).padStart(4, "0")}`,
      domain: `${names[k]}-${i}.${"unnc.space"}`,
      url: null,
      prompt: SPECS[k].subtitle,
      hasScreenshot: false as const,
      createdAt: Date.now() - (count - i) * 60_000,
      demoIndex: i,
      styleHint: SPECS[k].styleHint,
    };
  });
}
