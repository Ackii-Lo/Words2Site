/**
 * 大屏演示页生成器:/screen?demo=N 时填充 N 张模拟卡片(srcdoc),
 * 用于压测滚动墙与活动前大屏预演,不依赖服务端数据。
 * 产物为自包含 HTML(无外链、无 emoji),按模板参数生成多样化版式。
 */

interface DemoSpec {
  title: string;
  subtitle: string;
  tags: string[];
  bg: string; // CSS background
  ink: string; // 前景色
  accent: string; // 强调色
  layout: "hero" | "cards" | "split" | "stripes";
}

const SPECS: DemoSpec[] = [
  { title: "猫咪图鉴", subtitle: "三花 · 布偶 · 橘猫档案", tags: ["宠物", "日常"], bg: "linear-gradient(160deg,#FF9EC4,#FF6E9C)", ink: "#FFFFFF", accent: "#FFE3EE", layout: "cards" },
  { title: "深空观测站", subtitle: "今晚的星象与观测计划", tags: ["天文", "夜观"], bg: "radial-gradient(120% 100% at 20% 0%,#1B2A6B 0%,#0A1030 70%)", ink: "#E7ECFF", accent: "#8FA6FF", layout: "hero" },
  { title: "手冲咖啡笔记", subtitle: "耶加雪菲 · 水温 92°C", tags: ["咖啡", "冲煮"], bg: "linear-gradient(180deg,#4A2F1D,#2B1A0F)", ink: "#F3E7D8", accent: "#D8A25E", layout: "stripes" },
  { title: "水墨江南", subtitle: "小桥 流水 人家", tags: ["旅行", "风景"], bg: "linear-gradient(180deg,#F5F2EA,#E4DECE)", ink: "#2B2B26", accent: "#8C3B2E", layout: "split" },
  { title: "节奏实验室", subtitle: "校园乐队排练实录", tags: ["音乐", "现场"], bg: "linear-gradient(135deg,#12002E,#4B0A6B)", ink: "#F4E9FF", accent: "#FF5ED2", layout: "stripes" },
  { title: "火锅研究所", subtitle: "麻辣锅底风味曲线", tags: ["美食", "研究"], bg: "linear-gradient(160deg,#C43A1C,#7A1B08)", ink: "#FFF2E8", accent: "#FFC53D", layout: "cards" },
  { title: "绿茵战报", subtitle: "赛季数据与赛程速览", tags: ["足球", "数据"], bg: "linear-gradient(180deg,#0B3D2C,#06281C)", ink: "#E6F5EC", accent: "#57D9A3", layout: "split" },
  { title: "生日快乐", subtitle: "给九月的小寿星", tags: ["祝福", "派对"], bg: "linear-gradient(135deg,#FFD98E,#FF9E7A)", ink: "#5A2A1A", accent: "#FFFFFF", layout: "hero" },
  { title: "海边邮局", subtitle: "慢递一封明信片", tags: ["文创", "海岸"], bg: "linear-gradient(180deg,#9FE2E8,#2E7DA8)", ink: "#FFFFFF", accent: "#FFE9B8", layout: "cards" },
  { title: "旧书地下室", subtitle: "绝版书交换计划", tags: ["读书", "交换"], bg: "linear-gradient(160deg,#3E3A33,#211E19)", ink: "#EFE9DC", accent: "#C9B458", layout: "stripes" },
  { title: "水族馆夜场", subtitle: "发光水母与深海走廊", tags: ["海洋", "夜场"], bg: "radial-gradient(110% 90% at 50% 10%,#0E4B66,#041E2E)", ink: "#DFF6FF", accent: "#4FD8EB", layout: "hero" },
  { title: "拉面地图", subtitle: "豚骨 酱油 味噌 三大流派", tags: ["探店", "地图"], bg: "linear-gradient(180deg,#F28C3D,#C2511F)", ink: "#FFF6EC", accent: "#3B2415", layout: "split" },
];

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
}

function body(spec: DemoSpec): string {
  const tags = spec.tags.map((t) => `<span style="border:1px solid ${spec.accent};color:${spec.accent};border-radius:999px;padding:2px 10px;font-size:11px">${esc(t)}</span>`).join(" ");
  switch (spec.layout) {
    case "hero":
      return `
        <div style="height:46%;display:grid;place-items:center;border-bottom:2px solid ${spec.accent}">
          <div style="width:88px;height:88px;border:3px solid ${spec.accent};border-radius:50%;display:grid;place-items:center"><div style="width:44px;height:44px;background:${spec.accent};border-radius:50%"></div></div>
        </div>
        <div style="padding:20px 22px">
          <div style="font-size:26px;font-weight:800;letter-spacing:2px">${esc(spec.title)}</div>
          <div style="margin-top:6px;font-size:13px;opacity:.85">${esc(spec.subtitle)}</div>
          <div style="margin-top:14px;display:flex;gap:8px">${tags}</div>
          <div style="margin-top:22px;height:8px;border-radius:99px;background:${spec.accent}33"><div style="width:64%;height:100%;border-radius:99px;background:${spec.accent}"></div></div>
        </div>`;
    case "cards":
      return `
        <div style="padding:22px">
          <div style="font-size:24px;font-weight:800">${esc(spec.title)}</div>
          <div style="margin-top:4px;font-size:12px;opacity:.85">${esc(spec.subtitle)}</div>
          <div style="margin-top:16px;display:grid;grid-template-columns:1fr 1fr;gap:10px">
            ${Array.from({ length: 4 }, (_, i) => `
              <div style="border-radius:12px;background:${spec.accent}26;padding:12px">
                <div style="height:52px;border-radius:8px;background:${spec.accent};opacity:${0.9 - i * 0.15}"></div>
                <div style="margin-top:8px;font-size:12px;font-weight:600">栏目 ${i + 1}</div>
              </div>`).join("")}
          </div>
          <div style="margin-top:14px;display:flex;gap:8px">${tags}</div>
        </div>`;
    case "split":
      return `
        <div style="display:flex;height:100%">
          <div style="width:46%;background:${spec.accent};display:grid;place-items:center;padding:16px">
            <div style="writing-mode:vertical-rl;font-size:30px;font-weight:900;letter-spacing:10px;color:${spec.bg.includes("#F5F2EA") ? "#F5F2EA" : "#1D1D1D"}">${esc(spec.title)}</div>
          </div>
          <div style="flex:1;padding:22px 18px">
            <div style="font-size:13px;opacity:.85">${esc(spec.subtitle)}</div>
            ${Array.from({ length: 3 }, () => `<div style="margin-top:14px;height:10px;border-radius:99px;background:${spec.ink};opacity:.18"></div><div style="margin-top:8px;height:10px;width:70%;border-radius:99px;background:${spec.ink};opacity:.18"></div>`).join("")}
            <div style="margin-top:18px">${tags}</div>
          </div>
        </div>`;
    case "stripes":
    default:
      return `
        <div style="padding:22px">
          <div style="display:flex;align-items:baseline;gap:10px"><div style="font-size:26px;font-weight:900">${esc(spec.title)}</div><div style="font-size:11px;letter-spacing:3px;color:${spec.accent}">LIVE</div></div>
          <div style="margin-top:6px;font-size:12px;opacity:.85">${esc(spec.subtitle)}</div>
          ${Array.from({ length: 3 }, (_, i) => `
            <div style="margin-top:14px;border-left:4px solid ${spec.accent};padding:8px 12px;background:${spec.ink}0D">
              <div style="font-size:13px;font-weight:700">记录 0${i + 1}</div>
              <div style="margin-top:4px;font-size:11px;opacity:.7">———————— ————</div>
            </div>`).join("")}
          <div style="margin-top:14px;display:flex;gap:8px">${tags}</div>
        </div>`;
  }
}

export function demoPage(index: number): string {
  const spec = SPECS[index % SPECS.length];
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  * { margin: 0; box-sizing: border-box; }
  body { font-family: system-ui, -apple-system, "PingFang SC", sans-serif; background: ${spec.bg}; color: ${spec.ink}; min-height: 100vh; }
  header { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; font-size: 10px; letter-spacing: 2px; opacity: .75; font-family: "IBM Plex Mono", monospace; }
</style></head>
<body>
  <header><span>WORDS2SITE</span><span>DEMO-${String(index + 1).padStart(2, "0")}</span></header>
  ${body(spec)}
</body></html>`;
}

/** 模拟条目(与真实条目同构) */
export function demoItems(count: number): Array<{
  taskId: string;
  code: string | null;
  domain: string | null;
  url: null;
  prompt: string;
  hasScreenshot: false;
  createdAt: number;
  demoIndex: number;
}> {
  const names = ["cat", "space", "coffee", "ink", "beat", "hotpot", "pitch", "bday", "seamail", "books", "aqua", "ramen"];
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
    };
  });
}
