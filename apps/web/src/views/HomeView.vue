<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { api } from "@/composables/useApi";
import { useTaskPolling } from "@/composables/useTaskPolling";
import { deviceId } from "@/lib/utils";
import { t, type MessageKey } from "@/i18n";
import CpuLogo from "@/components/CpuLogo.vue";
import LanguageSwitch from "@/components/LanguageSwitch.vue";
import IntroStep from "@/components/home/IntroStep.vue";
import FormStep from "@/components/home/FormStep.vue";
import WaitingStep from "@/components/home/WaitingStep.vue";
import DoneStep from "@/components/home/DoneStep.vue";

/**
 * /start 壳 + 四步状态机：intro → form → waiting → done。
 * 各步骤的 UI/交互在 components/home/* 里；这里只管步骤切换、
 * 提交（API）、轮询与 published→凭证 组装、restart。
 */
type Step = "intro" | "form" | "waiting" | "done";

const STEPS: Step[] = ["intro", "form", "waiting", "done"];

const step = ref<Step>("intro");
const submitting = ref(false);
const submitError = ref("");

interface SubmitPayload {
  text: string;
  email: string;
  domainLabel: string;
  isPublic: boolean;
  pageLang: "zh" | "en";
}
/** 最近一次提交（failed「点击刷新」重发用；表单步已卸载，输入态不在手上） */
let lastPayload: SubmitPayload | null = null;
const lastEmail = ref("");

const taskId = ref("");
const cert = ref<{
  code: string;
  publishUrl: string | null;
  verifyUrl: string;
  domain: string | null;
  email: string | null;
} | null>(null);

const { status, start: startPolling } = useTaskPolling();

const stepIndex = computed(() => Math.max(1, STEPS.indexOf(step.value) + 1));
const stepLabel = computed(() => t(`home.step.${step.value}` as MessageKey));
const stepNum = computed(() => String(stepIndex.value).padStart(2, "0"));
const progressPct = computed(() => (stepIndex.value / STEPS.length) * 100);
const failed = computed(() => status.value?.status === "failed");

watch(
  () => status.value?.status,
  (s) => {
    if (s !== "published") return;
    const st = status.value!;
    cert.value = {
      code: st.code ?? "",
      publishUrl: st.publishUrl,
      verifyUrl: `${location.origin}/verify/${st.code}`,
      domain: st.publishUrl
        ? st.publishUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")
        : null,
      email: lastEmail.value || null,
    };
    step.value = "done";
  },
);

function onSubmit(payload: SubmitPayload) {
  lastPayload = payload;
  lastEmail.value = payload.email;
  void submitTask();
}

async function submitTask() {
  if (!lastPayload) return;
  submitting.value = true;
  submitError.value = "";
  try {
    const data = await api<{ taskId: string; domain: string }>("/api/tasks", {
      method: "POST",
      body: JSON.stringify({
        text: lastPayload.text,
        deviceId: deviceId(),
        email: lastPayload.email,
        domainLabel: lastPayload.domainLabel,
        isPublic: lastPayload.isPublic,
        pageLang: lastPayload.pageLang,
      }),
    });
    taskId.value = data.taskId;
    step.value = "waiting";
    startPolling(data.taskId);
  } catch (e) {
    submitError.value = e instanceof Error ? e.message : String(e);
    step.value = "form"; // 回表单步改信息（409 撞名等场景）
  } finally {
    submitting.value = false;
  }
}

function restart() {
  step.value = "form";
  lastPayload = null;
  lastEmail.value = "";
  taskId.value = "";
  cert.value = null;
  submitError.value = "";
}
</script>

<template>
  <div class="shell">
    <!-- 顶部：左上角标（点回现场大屏）+ 右对齐空心标题 -->
    <header class="hero">
      <RouterLink
        to="/"
        class="badge"
        :aria-label="t('home.backToScreen')"
        :title="t('home.backToScreen')"
      >
        <CpuLogo class="badge-mark" ink="#F7D447" />
      </RouterLink>
      <h1 class="hero-title"><span>WORDS TO</span><span>WEBSITE</span></h1>
    </header>

    <!-- 主卡：黑带卡头（编号/名称/步骤）+ 进度条 + 卡身 -->
    <main class="sheet">
      <div class="sheet-head">
        <span class="sheet-num">{{ stepNum }}</span>
        <span class="sheet-div"></span>
        <span class="sheet-name">{{ stepLabel }}</span>
        <span class="sheet-step">{{
          t("home.stepOf", { n: stepIndex, total: STEPS.length })
        }}</span>
      </div>
      <!-- 语言切换：卡身右上角，覆盖在内容层之上 -->
      <LanguageSwitch class="lang-float" />
      <div class="sheet-track">
        <div class="sheet-fill" :style="{ width: progressPct + '%' }"></div>
      </div>

      <div class="sheet-body">
        <IntroStep v-if="step === 'intro'" @next="step = 'form'" />
        <FormStep
          v-else-if="step === 'form'"
          :submitting="submitting"
          :error="submitError"
          @submit="onSubmit"
        />
        <WaitingStep
          v-else-if="step === 'waiting'"
          :email="lastEmail"
          :failed="failed"
          :error="status?.error ?? null"
          @retry="submitTask"
        />
        <DoneStep v-else-if="cert" :cert="cert" @restart="restart" />
      </div>
    </main>

    <footer class="foot">
      <p class="foot-brand">Presented by CPU</p>
      <p class="foot-sub">The University of Nottingham Ningbo China</p>
    </footer>
  </div>
</template>

<style scoped>
/* ===== 画布：CPU 黄底 + 极淡虚线网格 ===== */
.shell {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 375px;
  min-height: 100dvh;
  margin: 0 auto;
  background-color: #f7d447;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='375' height='104'%3E%3Cg stroke='rgba(28,25,23,0.12)' stroke-width='1.5' stroke-dasharray='6.5 6.5' fill='none'%3E%3Cline x1='125' y1='0' x2='125' y2='104'/%3E%3Cline x1='250' y1='0' x2='250' y2='104'/%3E%3Cline x1='0' y1='0' x2='375' y2='0'/%3E%3C/g%3E%3C/svg%3E");
  background-size: 375px 104px;
  background-repeat: repeat-y;
}

/* ===== 顶部：角标 + 空心标题 ===== */
.hero {
  position: relative;
  padding: calc(10px + env(safe-area-inset-top)) 16px 0;
}
.badge {
  position: absolute;
  left: 16px;
  top: calc(10px + env(safe-area-inset-top));
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  background: #1c1917;
}
.badge:active {
  transform: scale(0.94);
}
.badge-mark {
  width: 30px;
  height: 28px;
}
.hero-title {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  width: 100%;
  margin: 4px 0 0;
  font-size: 48px;
  font-weight: 900;
  line-height: 54px;
  letter-spacing: 1px;
  color: transparent;
  -webkit-text-stroke: 2.5px #faf7e8;
  white-space: nowrap;
}

/* ===== 主卡：白卡黑描边 + 硬投影 ===== */
.sheet {
  position: relative;
  width: 331px;
  margin: 46px 0 0 16px;
  background: #fffdf9;
  border: 3px solid #1c1917;
  border-radius: 5px;
  box-shadow: 8px 8px 0 #1c1917;
  overflow: hidden;
}
.sheet-head {
  display: flex;
  align-items: center;
  height: 48px;
  padding: 0 16px;
  background: #1c1917;
}
.sheet-num {
  font-size: 17px;
  font-weight: 900;
  color: #f7d447;
}
.sheet-div {
  width: 1px;
  height: 22px;
  margin: 0 12px;
  background: rgba(250, 247, 232, 0.32);
}
.sheet-name {
  font-size: 16px;
  font-weight: 900;
  color: #faf7e8;
}
.sheet-step {
  margin-left: auto;
  font-family: Consolas, Menlo, ui-monospace, monospace;
  font-size: 10px;
  color: rgba(250, 247, 232, 0.72);
}
.sheet-track {
  height: 3.5px;
  background: rgba(250, 247, 232, 0.18);
}
.sheet-fill {
  height: 100%;
  background: #f7d447;
  transition: width 0.3s ease;
}
.sheet-body {
  padding: 24px 22px 28px;
}
/* 语言切换：黑带与进度条之下、卡身右上角，不占文档流 */
.lang-float {
  position: absolute;
  top: 58px;
  right: 12px;
  z-index: 5;
}

/* ===== 页脚厂牌 ===== */
.foot {
  margin-top: auto;
  padding: 26px 0 14px;
  padding-bottom: calc(14px + env(safe-area-inset-bottom));
  padding-left: 16px;
}
.foot-brand {
  font-size: 9px;
  font-weight: 900;
  color: #1c1917;
}
.foot-sub {
  margin-top: 3px;
  font-size: 7.2px;
  font-weight: 700;
  color: #1c1917;
}

/* ============================================================
   桌面端（电脑版方案二，1440×900 定稿）
   角标左上 88px、单行空心大标题右对齐、
   880px 居中白卡 + 72px 黑带卡头 + 10px 硬投影
   ============================================================ */
@media (min-width: 900px) {
  .shell {
    max-width: none;
    min-height: 100vh;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='360' height='240'%3E%3Cpath d='M0 0V240M0 0H360' fill='none' stroke='rgba(28,25,23,0.12)' stroke-width='3' stroke-dasharray='9 12'/%3E%3C/svg%3E");
    background-size: 360px 240px;
    background-repeat: repeat;
  }

  /* 顶部：角标贴左上角，标题单行右对齐、距右 40px */
  .hero {
    padding: 13px 40px 0 0;
  }
  .badge {
    left: 0;
    top: 0;
    width: 88px;
    height: 88px;
  }
  .badge-mark {
    width: 55px;
    height: 52px;
  }
  .hero-title {
    flex-direction: row;
    justify-content: flex-end;
    gap: 0.28em;
    margin: 0;
    font-size: 110px;
    line-height: 1;
    letter-spacing: 2px;
    -webkit-text-stroke: 3.5px #faf7e8;
  }

  /* 主卡：880px 居中 */
  .sheet {
    width: 880px;
    margin: 45px auto 0;
    border-radius: 6px;
    box-shadow: 10px 10px 0 #1c1917;
  }
  .sheet-head {
    height: 67px;
    padding: 0 30px;
  }
  .sheet-num {
    font-size: 26px;
    line-height: 1;
  }
  .sheet-div {
    height: 26px;
    margin: 0 16px;
    background: rgba(250, 247, 232, 0.28);
  }
  .sheet-name {
    font-size: 26px;
    line-height: 1;
  }
  .sheet-step {
    font-size: 12px;
    letter-spacing: 1px;
    color: rgba(250, 247, 232, 0.6);
  }
  .sheet-track {
    height: 5px;
  }
  .sheet-fill {
    height: 5px;
  }
  .sheet-body {
    padding: 44px 48px 48px;
  }
  .lang-float {
    top: 86px;
    right: 20px;
  }

  /* 页脚厂牌：绝对定位左下 */
  .foot {
    position: absolute;
    left: 40px;
    bottom: 30px;
    margin: 0;
    padding: 0;
  }
  .foot-brand {
    font-size: 13px;
    letter-spacing: 0.5px;
  }
  .foot-sub {
    margin-top: 5px;
    font-size: 12px;
    color: rgba(28, 25, 23, 0.62);
  }
}
</style>
