/**
 * 造 10 个假任务（mock provider 直接真实跑队列），压测队列/管理页。
 * 用法：pnpm seed
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// 直接复用 server 模块
const src = await import("../src/index.js").catch(() => null);
if (!src) {
  console.error("无法加载 server，请用 GENERATION_PROVIDER=mock pnpm seed");
  process.exit(1);
}

const { tasks } = await import("../src/db.js");
const { queue } = await import("../src/services/queue.js");
const { newTaskId } = await import("../src/util/ids.js");

const prompts = [
  "帮我做一个展示我家猫咪咪咪的网页，粉色可爱风",
  "做一个介绍咖啡历史的网页，复古报纸风格",
  "做一个太空探索主题的网页，深色星空背景",
  "做一个介绍西湖十景的网页，中国风",
  "做一个迷你游戏介绍页，像素风",
  "做一个生日祝福网页给小明，气球和彩带",
  "做一个介绍 Python 编程的网页，极客风",
  "做一个火锅菜单网页，让人流口水的设计",
  "做一个旅行日记网页，手账贴纸风",
  "做一个音乐节奏游戏主页，赛博朋克霓虹",
];

for (const p of prompts) {
  const id = newTaskId();
  tasks.create({ id, prompt: p, transcript: null, ip: "127.0.0.1", deviceId: "seed-script" });
  queue.enqueueGen(id);
}
console.log(`已入队 ${prompts.length} 个测试任务`);
setTimeout(() => process.exit(0), 1000);
