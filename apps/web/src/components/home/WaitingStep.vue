<script setup lang="ts">
import { onUnmounted, ref, watch } from "vue";
import CpuLogo from "@/components/CpuLogo.vue";
import { t, waitingMessages } from "@/i18n";

/**
 * 步骤③ 生成中 / 卡住了：logo 动画 + 假进度 + 轮换文案 + failed 应急 UI。
 * 定时器全部内聚，卸载或进入 failed 即停；重试点击抛给父级（用上次提交重发）。
 */
const props = defineProps<{
  email: string;
  failed: boolean;
  error: string | null;
}>();
const emit = defineEmits<{ retry: [] }>();

/* ---------- 假进度条：先快后慢逼近 92%，完成瞬间由父级切走 ---------- */
const waitProgress = ref(0);
const PROGRESS_RUN = 48_000;
let rafId = 0;
let progressStart = 0;
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

function progressFrame() {
  const t = Math.min(1, (performance.now() - progressStart) / PROGRESS_RUN);
  waitProgress.value = easeOut(t) * 92;
  rafId = requestAnimationFrame(progressFrame);
}

/* ---------- 轮换文案：5s 一句 + 0.5s 淡入淡出 ---------- */
const msgIndex = ref(0);
const msgVisible = ref(false);
let msgTimer = 0;
let msgFadeTimer = 0;

function startTimers() {
  stopTimers();
  waitProgress.value = 0;
  progressStart = performance.now();
  rafId = requestAnimationFrame(progressFrame);
  msgIndex.value = 0;
  msgVisible.value = true;
  msgTimer = window.setInterval(() => {
    msgVisible.value = false;
    msgFadeTimer = window.setTimeout(() => {
      msgIndex.value = (msgIndex.value + 1) % waitingMessages().length;
      msgVisible.value = true;
    }, 500);
  }, 5000);
}

function stopTimers() {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = 0;
  if (msgTimer) clearInterval(msgTimer);
  msgTimer = 0;
  if (msgFadeTimer) clearTimeout(msgFadeTimer);
  msgFadeTimer = 0;
  msgVisible.value = false;
}

startTimers();
watch(
  () => props.failed,
  (f) => {
    if (f) stopTimers();
  },
);
onUnmounted(stopTimers);
</script>

<template>
  <div class="wait-wrap">
    <div class="logo-wrap">
      <span class="logo-halo"></span>
      <span class="logo-circle"
        ><CpuLogo class="logo-mark" ink="#000000"
      /></span>
    </div>

    <template v-if="!failed">
      <h2 class="wait-title">{{ t("waiting.title") }}</h2>
      <p class="wait-sub">{{ t("waiting.sub", { email: email || "—" }) }}</p>
      <div class="ai-bar">
        <div class="ai-bar-fill" :style="{ width: waitProgress + '%' }"></div>
      </div>
      <div class="msg-zone">
        <p class="msg" :class="{ 'msg-show': msgVisible }">
          {{ waitingMessages()[msgIndex] }}
        </p>
      </div>
    </template>

    <template v-else>
      <h2 class="wait-title">{{ t("waiting.failedTitle") }}</h2>
      <button
        class="btn-ink btn-narrow no-arrow"
        type="button"
        @click="emit('retry')"
      >
        {{ t("waiting.retry") }}
      </button>
      <button class="btn-dashed" type="button">
        {{ t("waiting.help") }}
      </button>
      <p class="err-code">
        {{ t("waiting.errorCode") }} · {{ error || "W2S-GEN-TIMEOUT" }}
      </p>
    </template>
  </div>
</template>

<style scoped>
.wait-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 34px;
}
.logo-wrap {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100px;
  height: 100px;
  animation: breathe 2.6s ease-in-out infinite;
}
.logo-halo {
  position: absolute;
  inset: -10px;
  border: 2px solid rgba(28, 25, 23, 0.4);
  border-radius: 50%;
  animation: halo 2.6s ease-out infinite;
}
.logo-circle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100px;
  height: 100px;
  border: 2px solid #1c1917;
  border-radius: 50%;
  background: #f7d447;
  box-sizing: border-box;
  animation: floaty 3.2s ease-in-out infinite;
}
.logo-mark {
  width: 46px;
  height: 44px;
}
@keyframes breathe {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.045);
  }
}
@keyframes floaty {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-5px);
  }
}
@keyframes halo {
  0% {
    transform: scale(0.92);
    opacity: 0.8;
  }
  70%,
  100% {
    transform: scale(1.18);
    opacity: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .logo-wrap,
  .logo-circle,
  .logo-halo {
    animation: none;
  }
}

.wait-title {
  margin-top: 26px;
  font-size: 17px;
  font-weight: 900;
  line-height: 1.2;
  text-align: center;
  color: #1c1917;
}
.wait-sub {
  margin-top: 8px;
  font-size: 11px;
  line-height: 1.6;
  text-align: center;
  color: rgba(28, 25, 23, 0.68);
  word-break: break-all;
}
.ai-bar {
  width: 200px;
  height: 6px;
  margin-top: 14px;
  border-radius: 3px;
  background: #efe4a1;
  overflow: hidden;
}
.ai-bar-fill {
  height: 100%;
  border-radius: 3px;
  background: #f7d447;
  transition: width 0.3s linear;
}
.msg-zone {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  width: 265px;
  min-height: 42px;
  margin-top: 6px;
  text-align: center;
}
.msg {
  font-size: 11px;
  line-height: 1.6;
  color: #57534e;
  opacity: 0;
  transform: translateY(6px);
  transition:
    opacity 0.5s ease,
    transform 0.5s ease;
}
.msg-show {
  opacity: 1;
  transform: translateY(0);
}
.err-code {
  margin-top: 22px;
  font-family: Consolas, Menlo, ui-monospace, monospace;
  font-size: 9.5px;
  color: rgba(28, 25, 23, 0.5);
}

.btn-ink {
  position: relative;
  width: 100%;
  height: 46px;
  margin-top: 22px;
  border: 0;
  border-radius: 4px;
  background: #1c1917;
  color: #f7d447;
  font-size: 13px;
  font-weight: 800;
  transition: transform 0.12s ease;
}
.btn-ink::after {
  content: "→";
  position: absolute;
  right: 16px;
  font-size: 15px;
  font-weight: 700;
}
.btn-ink.no-arrow::after {
  content: none;
}
.btn-ink:active:not(:disabled) {
  transform: scale(0.985);
}
.btn-ink:disabled {
  opacity: 0.45;
}
.btn-narrow {
  display: block;
  width: 200px;
  margin: 22px auto 0;
}
.btn-dashed {
  display: block;
  width: 200px;
  height: 40px;
  margin: 14px auto 0;
  border: 1.5px dashed #1c1917;
  border-radius: 4px;
  background: none;
  color: #1c1917;
  font-size: 12px;
  font-weight: 700;
}

/* ===== 桌面端 ===== */
@media (min-width: 900px) {
  .wait-wrap {
    padding-top: 64px;
  }
  .logo-wrap,
  .logo-circle {
    width: 190px;
    height: 190px;
  }
  .logo-halo {
    inset: -18px;
    border-width: 3px;
  }
  .logo-mark {
    width: 87px;
    height: 84px;
  }
  .wait-title {
    margin-top: 26px;
    font-size: 34px;
    letter-spacing: -0.5px;
  }
  .wait-sub {
    margin-top: 12px;
    font-size: 15.5px;
    font-weight: 700;
  }
  .ai-bar {
    width: 360px;
    height: 8px;
    margin-top: 22px;
    border-radius: 4px;
  }
  .msg-zone {
    width: 560px;
    min-height: 52px;
    margin-top: 20px;
  }
  .msg {
    font-size: 15.5px;
    font-weight: 700;
    color: #57534e;
  }
  .err-code {
    margin-top: 26px;
    font-size: 12.5px;
    color: #78716c;
  }
  .btn-ink {
    height: 64px;
    margin-top: 32px;
    font-size: 17px;
    letter-spacing: 1px;
  }
  .btn-ink::after {
    right: 26px;
    font-size: 18px;
  }
  .btn-narrow {
    width: 420px;
  }
  .btn-dashed {
    width: 420px;
    height: 58px;
    margin-top: 16px;
    border: 2px dashed #1c1917;
    font-size: 15px;
  }
}
</style>
