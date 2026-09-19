<script setup lang="ts">
import LazyFrame from "@/components/LazyFrame.vue";
import { demoPage } from "@/lib/demoPages";
import { apiUrl } from "@/lib/apiBase";
import { t } from "@/i18n";
import { DEFAULT_STYLE, isCardStyle, type CardStyle } from "@/lib/styleHint";

/**
 * 胶卷上的「一格底片」：页面预览 + 卡脚（门牌域名 + 凭证章）。
 * 尺寸由父级给定（桌面 146×234、手机 ≈118×189），内容按比例缩放；
 * 远端压暗由父层通过 CSS 变量 --veil 控制（0=全亮）。
 *
 * styleHint 决定渲染哪种外壳（七式之一）；缺省 archive 米纸衬底。
 * 页面区：有截图用 <img>（性能），演示卡/无截图页才落 iframe（LazyFrame）。
 *
 * 几何值全部对着定稿视觉稿（Desktop/CPU/大屏卡片样式七种_带文字.png）
 * 量出来的百分比走，改动前先量再改（见 skill words2site-dev）。
 */
const props = withDefaults(
  defineProps<{
    taskId: string;
    code: string | null;
    domain: string | null;
    url: string | null;
    hasScreenshot: boolean;
    demoIndex?: number;
    styleHint?: CardStyle | null;
    w: number;
    h: number;
  }>(),
  { demoIndex: undefined, styleHint: null },
);

/**
 * 外壳取值：只认七个合法字面量。
 * 旧记录可能是 null，迁移时补的默认值可能是空串 —— 都不能直接当样式用，
 * 否则会落进最后的兜底模板（无外壳），看起来和"没做这个功能"一样。
 */
const style: CardStyle = isCardStyle(props.styleHint)
  ? props.styleHint
  : DEFAULT_STYLE;

/**
 * 页面区的源，三档：
 * - 有截图 → frameImg：<img> 直出（浏览器解码缓存，GPU 合成远比 iframe 便宜；
 *   大屏几十张卡同时滚动时这是性能命门）
 * - 演示卡 → frameSrc.srcdoc：iframe 内置示例页
 * - 真实页无截图 → frameSrc.src：iframe 兜底（活动常态是人人有截图，此档近零）
 */
const frameImg =
  props.demoIndex === undefined && props.hasScreenshot
    ? apiUrl(`/api/tasks/${props.taskId}/screenshot`)
    : null;
const frameSrc =
  props.demoIndex !== undefined
    ? { srcdoc: demoPage(props.demoIndex ?? 0) }
    : props.hasScreenshot
      ? {}
      : { src: apiUrl(`/api/tasks/${props.taskId}/html`) };

const cardTitle = props.domain ?? props.taskId;

/**
 * em 基准：外壳里的零碎（标头 NO.、域名、凭证章、巨号…）都写成 em，
 * 需要随卡片尺寸等比缩放。146px 宽的底片上取 12.5px —— 于是
 * 0.5em≈6.3px（域名）、0.78em≈9.8px（NO.）、4em≈50px（巨号）都落在可读区间；
 * 同时 0.6em 的内边距≈7.5px，页面预览才真正和卡边留出呼吸。
 * （旧值 `w / 146` 让基准恒等于 1px，所有 em 尺寸塌成亚像素、渲染成空白小方块。）
 */
const emBase = (props.w / 146) * 12.5;
</script>

<template>
  <div
    class="relative"
    :style="{ width: w + 'px', height: h + 'px', fontSize: emBase + 'px' }"
  >
    <!-- ============================================================
         01 档案 · 日常
         米纸衬底＋黑标头(13%)＋白页面区(左右7%/上14%/下20%)＋黄胶囊凭证章
       ============================================================ -->
    <template v-if="style === 'archive'">
      <div class="absolute inset-0 overflow-hidden rounded-[3px] bg-[#FAF7E8]">
        <!-- 黑标头 -->
        <div
          class="absolute inset-x-0 top-0 flex items-center justify-between bg-[#1C1917] px-[0.7em]"
          style="height: 13%"
        >
          <span
            class="font-mono font-bold text-[#F7D447]"
            style="font-size: 0.78em; letter-spacing: 0.5px"
            >NO.01</span
          >
          <span
            class="truncate font-mono text-[#A8A29E]"
            style="font-size: 0.55em"
            >{{ props.domain ?? "" }}</span
          >
        </div>
        <!-- 白页面区（带轻阴影，和米纸分层） -->
        <div
          class="absolute bg-white"
          style="
            top: 14%;
            bottom: 20%;
            left: 7%;
            right: 7%;
            box-shadow: 0 1px 3px rgba(28, 25, 23, 0.12);
          "
        >
          <img
            v-if="frameImg"
            :src="frameImg"
            class="h-full w-full object-cover object-top"
            decoding="async"
            alt=""
          />
          <LazyFrame v-else v-bind="frameSrc" :title="cardTitle" />
        </div>
        <!-- 黄胶囊凭证章 -->
        <div class="absolute inset-x-0" style="bottom: 6.4%; height: 7%">
          <div
            v-if="props.code"
            class="mx-auto flex h-full w-[50%] items-center justify-center rounded-full bg-[#F7D447]"
          >
            <span
              class="truncate px-[0.3em] font-mono font-bold text-[#1C1917]"
              style="font-size: 0.6em; letter-spacing: 0.5px"
              >{{ props.code }}</span
            >
          </div>
        </div>
        <!-- 远端压暗 -->
        <div
          class="pointer-events-none absolute inset-0 bg-[rgba(18,16,14,1)]"
          style="opacity: var(--veil, 0)"
        />
      </div>
    </template>

    <!-- ============================================================
         02 满幕 · 科技
         页面铺满＋整卡黄色发丝边＋四角取景标＋上10%/下13% 黑信息条
       ============================================================ -->
    <template v-else-if="style === 'fullscreen'">
      <div class="absolute inset-0 overflow-hidden bg-[#0E1526]">
        <!-- 页面铺满 -->
        <div class="absolute inset-0">
          <img
            v-if="frameImg"
            :src="frameImg"
            class="h-full w-full object-cover object-top"
            decoding="async"
            alt=""
          />
          <LazyFrame v-else v-bind="frameSrc" :title="cardTitle" />
        </div>
        <!-- 顶黑信息条 -->
        <div
          class="absolute inset-x-0 top-0 flex items-center justify-between bg-[#1C1917]/92 px-[0.7em]"
          style="height: 10%"
        >
          <span
            class="truncate font-mono text-[#FAF7E8]"
            style="font-size: 0.55em"
            >{{ props.domain ?? "" }}</span
          >
          <span class="font-mono text-[#F7D447]" style="font-size: 0.55em"
            >02</span
          >
        </div>
        <!-- 底黑信息条：凭证码 -->
        <div
          class="absolute inset-x-0 bottom-0 flex items-center justify-between bg-[#1C1917]/94 px-[0.7em]"
          style="height: 13%"
        >
          <span
            v-if="props.code"
            class="font-mono font-bold text-[#F7D447]"
            style="font-size: 0.55em"
            >{{ props.code }}</span
          >
          <span class="ml-auto flex items-center gap-[0.3em]">
            <span
              class="inline-block rounded-full bg-[#F7D447]"
              style="width: 0.4em; height: 0.4em"
            />
            <span class="font-mono text-[#F7D447]" style="font-size: 0.55em">{{
              t("film.proof")
            }}</span>
          </span>
        </div>
        <!-- 整卡黄色发丝边 + 四角取景标 -->
        <svg
          class="pointer-events-none absolute inset-0"
          :width="w"
          :height="h"
          :viewBox="`0 0 ${w} ${h}`"
          preserveAspectRatio="none"
        >
          <rect
            :x="0.5"
            :y="0.5"
            :width="w - 1"
            :height="h - 1"
            stroke="#F7D447"
            stroke-width="1"
            fill="none"
          />
          <path
            :d="`M 0 ${h * 0.11} L 0 0 L ${w * 0.16} 0`"
            stroke="#F7D447"
            stroke-width="1.4"
            fill="none"
          />
          <path
            :d="`M ${w * 0.84} 0 L ${w} 0 L ${w} ${h * 0.11}`"
            stroke="#F7D447"
            stroke-width="1.4"
            fill="none"
          />
          <path
            :d="`M ${w} ${h * 0.89} L ${w} ${h} L ${w * 0.84} ${h}`"
            stroke="#F7D447"
            stroke-width="1.4"
            fill="none"
          />
          <path
            :d="`M ${w * 0.16} ${h} L 0 ${h} L 0 ${h * 0.89}`"
            stroke="#F7D447"
            stroke-width="1.4"
            fill="none"
          />
        </svg>
        <!-- 远端压暗 -->
        <div
          class="pointer-events-none absolute inset-0 bg-[rgba(18,16,14,1)]"
          style="opacity: var(--veil, 0)"
        />
      </div>
    </template>

    <!-- ============================================================
         03 书脊 · 文艺
         左黑脊柱 20%（竖排域名+码）＋黄竖线＋右侧米色页面区
       ============================================================ -->
    <template v-else-if="style === 'spine'">
      <div class="absolute inset-0 overflow-hidden bg-[#1C1917]">
        <!-- 左黑脊柱 -->
        <div
          class="absolute left-0 top-0 bottom-0 flex flex-col items-center justify-center bg-[#1C1917]"
          style="width: 20%"
        >
          <div
            class="rotate-180 font-mono text-[#C9C4BC]"
            style="
              writing-mode: vertical-rl;
              font-size: 0.5em;
              letter-spacing: 0.5px;
            "
          >
            {{ (props.domain ?? "").slice(0, 18) }}
          </div>
          <div
            v-if="props.code"
            class="rotate-180 font-mono text-[#8C867E]"
            style="
              writing-mode: vertical-rl;
              font-size: 0.45em;
              margin-top: 0.5em;
              letter-spacing: 0.5px;
            "
          >
            {{ props.code }}
          </div>
        </div>
        <!-- 脊柱右缘黄竖线 -->
        <div
          class="absolute top-0 bottom-0 bg-[#F7D447]"
          style="left: 20%; width: 1.8%"
        />
        <!-- 右侧米色页面区 -->
        <div
          class="absolute top-0 bottom-0 right-0 bg-[#F4EFE2]"
          style="left: 26%"
        >
          <!-- 顶部小标签：W2S + DEMO -->
          <div
            class="absolute inset-x-0 top-0 flex items-center justify-between px-[0.6em] pt-[0.5em]"
          >
            <span class="font-mono text-[#1C1917]" style="font-size: 0.5em"
              >W2S</span
            >
            <span class="font-mono text-[#1C1917]" style="font-size: 0.5em"
              >DEMO-01</span
            >
          </div>
          <!-- 页面区 -->
          <div class="absolute inset-x-[0.6em]" style="top: 10%; bottom: 11%">
            <img
              v-if="frameImg"
              :src="frameImg"
              class="h-full w-full object-cover object-top"
              decoding="async"
              alt=""
            />
            <LazyFrame v-else v-bind="frameSrc" :title="cardTitle" />
          </div>
          <!-- 底部小标签 -->
          <div
            class="absolute inset-x-0 bottom-0 flex items-center px-[0.6em]"
            style="height: 9%"
          >
            <span class="font-mono text-[#A8A29E]" style="font-size: 0.45em"
              >WORDS2SITE DEMO-01</span
            >
          </div>
        </div>
        <!-- 远端压暗 -->
        <div
          class="pointer-events-none absolute inset-0 bg-[rgba(18,16,14,1)]"
          style="opacity: var(--veil, 0)"
        />
      </div>
    </template>

    <!-- ============================================================
         04 巨号 · 科技
         深底＋出血大黄号 4em（占卡宽 35%）＋黄框取景窗(上23%/下3%)＋右上 mono 信息
       ============================================================ -->
    <template v-else-if="style === 'bigno'">
      <div class="absolute inset-0 overflow-hidden bg-[#1C1917]">
        <!-- 出血大黄号 -->
        <div
          class="pointer-events-none absolute left-[2%] top-[-0.06em] font-black text-[#F7D447] leading-none"
          style="font-size: 4em; letter-spacing: -0.05em"
        >
          07
        </div>
        <!-- 右上角 mono 信息：域名 + 码 -->
        <div
          class="absolute top-0 right-0 flex flex-col items-end gap-[0.25em] p-[0.55em]"
        >
          <span class="font-mono text-[#A8A29E]" style="font-size: 0.5em">{{
            props.domain ?? ""
          }}</span>
          <span
            v-if="props.code"
            class="font-mono text-[#F7D447]"
            style="font-size: 0.5em"
            >{{ props.code }}</span
          >
        </div>
        <!-- 黄框取景窗 -->
        <div
          class="absolute"
          style="
            top: 23%;
            bottom: 3%;
            left: 8%;
            right: 8%;
            border: 1.2px solid #f7d447;
          "
        >
          <div class="absolute inset-[1.5px] overflow-hidden">
            <img
              v-if="frameImg"
              :src="frameImg"
              class="h-full w-full object-cover object-top"
              decoding="async"
              alt=""
            />
            <LazyFrame v-else v-bind="frameSrc" :title="cardTitle" />
          </div>
        </div>
        <!-- 远端压暗 -->
        <div
          class="pointer-events-none absolute inset-0 bg-[rgba(18,16,14,1)]"
          style="opacity: var(--veil, 0)"
        />
      </div>
    </template>

    <!-- ============================================================
         05 拼贴 · 日常
         深底＋斜贴米纸(3.5%/rot-3.5°)＋黄胶带＋黄圆章(19%)＋底部黑条
       ============================================================ -->
    <template v-else-if="style === 'collage'">
      <div class="absolute inset-0 overflow-hidden bg-[#1C1917]">
        <div
          class="absolute"
          style="
            top: 2.5%;
            bottom: 3%;
            left: 3.5%;
            right: 3.5%;
            transform: rotate(-3.5deg);
          "
        >
          <!-- 米纸 -->
          <div class="absolute inset-0" style="background: #faf7e8" />
          <!-- 左上黄胶带（压住纸边） -->
          <div
            class="absolute"
            style="
              top: -1.5%;
              left: 4%;
              width: 26%;
              height: 5.5%;
              background: #f7d447;
            "
          />
          <!-- 右上黄圆章 -->
          <div
            class="absolute flex items-center justify-center rounded-full"
            style="
              top: 6%;
              right: 4%;
              width: 19%;
              aspect-ratio: 1;
              background: #f7d447;
            "
          >
            <span class="font-black text-[#1C1917]" style="font-size: 0.8em"
              >07</span
            >
          </div>
          <!-- 页面区 -->
          <div
            class="absolute"
            style="top: 17%; bottom: 12%; left: 4%; right: 4%"
          >
            <img
              v-if="frameImg"
              :src="frameImg"
              class="h-full w-full object-cover object-top"
              decoding="async"
              alt=""
            />
            <LazyFrame v-else v-bind="frameSrc" :title="cardTitle" />
          </div>
          <!-- 底部黑条：域名+码 -->
          <div
            class="absolute inset-x-0 bottom-0 flex items-center justify-between bg-[#1C1917] px-[0.5em]"
            style="height: 11%"
          >
            <span
              class="truncate font-mono text-[#C9C4BC]"
              style="font-size: 0.5em"
              >{{ props.domain ?? "" }}</span
            >
            <span
              v-if="props.code"
              class="font-mono text-[#F7D447]"
              style="font-size: 0.5em"
              >{{ props.code }}</span
            >
          </div>
        </div>
        <!-- 远端压暗 -->
        <div
          class="pointer-events-none absolute inset-0 bg-[rgba(18,16,14,1)]"
          style="opacity: var(--veil, 0)"
        />
      </div>
    </template>

    <!-- ============================================================
         06 泡泡 · 可爱
         白底大圆角＋黄虚线内框＋顶部黄 NO 章＋右上黄星＋粉页面区＋黄胶囊码章
         （黑底改白底：黑底上黄虚线过于喧哗，白底后粉页面区成为唯一色块）
       ============================================================ -->
    <template v-else-if="style === 'bubble'">
      <div
        class="absolute inset-0 overflow-hidden bg-white"
        style="border-radius: 11%"
      >
        <!-- 黄虚线内框 -->
        <div
          class="pointer-events-none absolute inset-[3.5%]"
          style="border: 1.6px dashed #f7d447; border-radius: 9%"
        />
        <!-- 顶部黄 NO 章 -->
        <div
          class="absolute left-1/2 flex -translate-x-1/2 items-center justify-center rounded-full bg-[#F7D447]"
          style="top: 3.6%; width: 30%; height: 6%"
        >
          <span class="font-black text-[#1C1917]" style="font-size: 0.58em"
            >NO.6</span
          >
        </div>
        <!-- 粉页面区 -->
        <div
          class="absolute overflow-hidden"
          style="
            top: 13%;
            left: 7%;
            right: 7%;
            bottom: 26%;
            background: #ffe3ee;
            border-radius: 7%;
          "
        >
          <img
            v-if="frameImg"
            :src="frameImg"
            class="h-full w-full object-cover object-top"
            decoding="async"
            alt=""
          />
          <LazyFrame v-else v-bind="frameSrc" :title="cardTitle" />
        </div>
        <!-- 右上黄星（压在粉页面区之上，与设计稿一致） -->
        <div
          class="absolute flex items-center justify-center"
          style="top: 13%; right: 6%"
        >
          <span
            class="text-[#F7D447]"
            style="font-size: 1.3em; line-height: 1; transform: rotate(8deg)"
            >★</span
          >
        </div>
        <!-- 底部域名 -->
        <div
          class="absolute inset-x-0 flex items-center justify-center"
          style="bottom: 19%; height: 6%"
        >
          <span
            class="truncate px-[0.4em] font-mono text-[#A8A29E]"
            style="font-size: 0.5em"
            >{{ props.domain ?? "" }}</span
          >
        </div>
        <!-- 底部黄胶囊码章 -->
        <div
          v-if="props.code"
          class="absolute left-1/2 flex -translate-x-1/2 items-center justify-center rounded-full bg-[#F7D447]"
          style="bottom: 2.8%; width: 58%; height: 8%; transform: rotate(-4deg)"
        >
          <span
            class="truncate px-[0.3em] font-bold tracking-widest text-[#1C1917]"
            style="font-size: 0.55em"
            >{{ props.code }}</span
          >
        </div>
        <!-- 远端压暗 -->
        <div
          class="pointer-events-none absolute inset-0 bg-[rgba(18,16,14,1)]"
          style="opacity: var(--veil, 0)"
        />
      </div>
    </template>

    <!-- ============================================================
         07 典雅 · 文艺
         深底＋黄色双细框(3%/6%)＋衬线 "No. 07"＋米色展签(上12%/下27%)＋分隔线＋衬线码
       ============================================================ -->
    <template v-else-if="style === 'classic'">
      <div
        class="absolute inset-0 overflow-hidden bg-[#1C1917]"
        style="border-radius: 2%"
      >
        <!-- 外细黄框 -->
        <div
          class="pointer-events-none absolute"
          style="inset: 3%; border: 0.9px solid #e0c23f; border-radius: 1.5%"
        />
        <!-- 内更细黄框 -->
        <div
          class="pointer-events-none absolute"
          style="
            inset: 6%;
            border: 0.6px solid rgba(247, 212, 71, 0.45);
            border-radius: 1.5%;
          "
        />
        <!-- 顶部 "No. 07" + 两侧短黄线 -->
        <div
          class="absolute inset-x-0 top-0 flex items-center justify-center gap-[0.6em]"
          style="height: 12%"
        >
          <span
            style="
              width: 13%;
              height: 0.6px;
              background: rgba(247, 212, 71, 0.6);
            "
          />
          <span
            class="italic text-[#F7D447]"
            style="
              font-family: Georgia, SimSun, serif;
              font-size: 0.72em;
              letter-spacing: 1.5px;
            "
            >No. 07</span
          >
          <span
            style="
              width: 13%;
              height: 0.6px;
              background: rgba(247, 212, 71, 0.6);
            "
          />
        </div>
        <!-- 米色展签页面区 -->
        <div
          class="absolute overflow-hidden"
          style="
            top: 12%;
            bottom: 27%;
            left: 12%;
            right: 12%;
            background: #f7f3e8;
          "
        >
          <img
            v-if="frameImg"
            :src="frameImg"
            class="h-full w-full object-cover object-top"
            decoding="async"
            alt=""
          />
          <LazyFrame v-else v-bind="frameSrc" :title="cardTitle" />
        </div>
        <!-- 短黄分隔线 -->
        <div
          class="absolute left-1/2 -translate-x-1/2"
          style="
            top: 81%;
            width: 34%;
            height: 0.6px;
            background: rgba(247, 212, 71, 0.7);
          "
        />
        <!-- 底部衬线码 -->
        <div
          class="absolute inset-x-0 flex items-center justify-center"
          style="top: 84%; height: 12%"
        >
          <span
            class="text-[#F7D447]"
            style="
              font-family: Georgia, SimSun, serif;
              font-size: 0.62em;
              letter-spacing: 1.5px;
            "
            >{{ t("film.proofCode", { code: props.code ?? "——" }) }}</span
          >
        </div>
        <!-- 远端压暗 -->
        <div
          class="pointer-events-none absolute inset-0 bg-[rgba(18,16,14,1)]"
          style="opacity: var(--veil, 0)"
        />
      </div>
    </template>

    <!-- 兜底（type 卡住时）：archive 同款，但不加 NO 标头 -->
    <template v-else>
      <div class="absolute inset-0 overflow-hidden bg-[#FAF7E8]">
        <img
          v-if="frameImg"
          :src="frameImg"
          class="h-full w-full object-cover object-top"
          decoding="async"
          alt=""
        />
        <LazyFrame v-else v-bind="frameSrc" :title="cardTitle" />
        <div
          class="pointer-events-none absolute inset-0 bg-[rgba(18,16,14,1)]"
          style="opacity: var(--veil, 0)"
        />
      </div>
    </template>

    <!-- 胶卷底片外框（与所有外壳共存；定稿：3px 描边居中在 +4 矩形上 → 外扩 3.5px） -->
    <div
      class="pointer-events-none absolute inset-[-3.5px] border-[3.5px] border-[rgba(14,12,10,.85)]"
    />
  </div>
</template>
