<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import { api } from "@/composables/useApi";
import { useTaskPolling } from "@/composables/useTaskPolling";
import { deviceId } from "@/lib/utils";
import RecorderPanel from "@/components/RecorderPanel.vue";
import PreviewFrame from "@/components/PreviewFrame.vue";
import CertificateCard from "@/components/CertificateCard.vue";
import CpuLogo from "@/components/CpuLogo.vue";
import { Check } from "lucide-vue-next";

type Step = "intro" | "record" | "info" | "waiting" | "preview" | "certificate";

const STEPS: { key: Step; label: string }[] = [
  { key: "intro", label: "欢迎" },
  { key: "record", label: "描述网页" },
  { key: "info", label: "填写信息" },
  { key: "waiting", label: "生成中" },
  { key: "preview", label: "预览" },
  { key: "certificate", label: "完成" },
];

const step = ref<Step>("intro");
const transcript = ref("");
const draft = ref("");
const recordedSeconds = ref(0);
const email = ref("");
const domainLabel = ref("");
const isPublic = ref(true);
const domainSuffix = ref(".unnc.space"); // 与服务端 DEPLOY_DOMAIN_TEMPLATE 对应
const inputMode = ref<"voice" | "typing">("voice");
const submitting = ref(false);
const submitError = ref("");
const taskId = ref("");
const htmlVersion = ref(0);
const cert = ref<{
  code: string;
  publishUrl: string | null;
  verifyUrl: string;
  domain: string | null;
  email: string | null;
} | null>(null);
const publishing = ref(false);

const { status, start: startPolling } = useTaskPolling();

const stepIndex = computed(() =>
  Math.max(1, STEPS.findIndex((s) => s.key === step.value) + 1),
);
const stepLabel = computed(() => STEPS[stepIndex.value - 1]?.label ?? "");
const progressPct = computed(() => (stepIndex.value / STEPS.length) * 100);

const onTranscribed = (payload: { text: string; seconds: number }) => {
  transcript.value = payload.text;
  draft.value = payload.text;
  recordedSeconds.value = payload.seconds;
};

watch(
  () => status.value?.status,
  (s) => {
    if (s === "done") {
      waitProgress.value = 100;
      htmlVersion.value++;
      step.value = "preview";
    }
  },
);

async function submitTask() {
  const text = draft.value.trim();
  if (text.length < 10) {
    submitError.value = "描述太短啦，至少 10 个字";
    step.value = "record";
    return;
  }
  submitting.value = true;
  submitError.value = "";
  try {
    const data = await api<{ taskId: string; domain: string }>("/api/tasks", {
      method: "POST",
      body: JSON.stringify({
        text,
        deviceId: deviceId(),
        transcript: transcript.value || null,
        email: email.value.trim(),
        domainLabel: domainLabel.value.trim(),
        isPublic: isPublic.value,
      }),
    });
    taskId.value = data.taskId;
    step.value = "waiting";
    startPolling(data.taskId);
  } catch (e) {
    submitError.value = e instanceof Error ? e.message : String(e);
    step.value = "info";
  } finally {
    submitting.value = false;
  }
}

const refineText = ref("");
const refining = ref(false);
const refineError = ref("");

async function submitRefine() {
  const text = refineText.value.trim();
  if (text.length < 2) return;
  refining.value = true;
  refineError.value = "";
  try {
    await api(`/api/tasks/${taskId.value}/refine`, {
      method: "POST",
      body: JSON.stringify({ text }),
    });
    refineText.value = "";
    step.value = "waiting";
    startPolling(taskId.value);
  } catch (e) {
    refineError.value = e instanceof Error ? e.message : String(e);
  } finally {
    refining.value = false;
  }
}

async function publish() {
  publishing.value = true;
  submitError.value = "";
  try {
    const data = await api<{ publishUrl: string; code: string }>(
      `/api/tasks/${taskId.value}/publish`,
      {
        method: "POST",
      },
    );
    cert.value = {
      code: data.code,
      publishUrl: data.publishUrl,
      verifyUrl: `${location.origin}/verify/${data.code}`,
      domain: data.publishUrl.replace(/^https?:\/\//, "").replace(/\/$/, ""),
      email: email.value.trim() || null,
    };
    step.value = "certificate";
  } catch (e) {
    submitError.value = e instanceof Error ? e.message : String(e);
  } finally {
    publishing.value = false;
  }
}

function restart() {
  step.value = "record";
  transcript.value = "";
  draft.value = "";
  recordedSeconds.value = 0;
  email.value = "";
  domainLabel.value = "";
  isPublic.value = true;
  taskId.value = "";
  cert.value = null;
  refineText.value = "";
  submitError.value = "";
}

function redoRecord() {
  transcript.value = "";
  draft.value = "";
  recordedSeconds.value = 0;
  submitError.value = "";
}

const waitingTitle = "正在搭建你的网页…";
const failed = computed(() => status.value?.status === "failed");

/* ---------- 生成中：进度条（先快后慢逼近 92%，完成瞬间 100%） ---------- */
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

/* ---------- 生成中：轮换文案（5s 一句 + 0.5s 淡入淡出） ---------- */
const messages = [
  "AI正在一块块搬砖砌你的网页…",
  "正在给你的网页挑一个合适的字体…",
  "网页刚做完热身运动，马上就出来见你",
  "正在用Ctrl+Z撤销几个用错的设计…",
  "灵感只在咖啡凉了之后才来",
  "这段话正在被一个AI看，但AI假装没看懂",
  "世界上第一个网页诞生于1991年，长得非常朴素",
  "HTTP里的404是「找不到」，418是「我是茶壶」",
  "宁诺计算机系有且只有一个直属学生团体——Computer Psycho Union",
  "CPU由三个部门组成：主席团·技术部·宣传策划部",
  "CPU每周都有周常活动：技术分享、Workshop、校内XCPC、师生茶话会、UNNC黑客松",
  "CPU做过这些项目：抽奖系统、会议签到、群二维码录取认证、UNNC黑客松评分Agent",
];
const msgIndex = ref(0);
const msgVisible = ref(false);
let msgTimer = 0;
let msgFadeTimer = 0;

function stopWaitingTimers() {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = 0;
  if (msgTimer) clearInterval(msgTimer);
  msgTimer = 0;
  if (msgFadeTimer) clearTimeout(msgFadeTimer);
  msgFadeTimer = 0;
  msgVisible.value = false;
}

watch(step, (s) => {
  stopWaitingTimers();
  if (s === "waiting") {
    waitProgress.value = 0;
    progressStart = performance.now();
    rafId = requestAnimationFrame(progressFrame);
    msgIndex.value = 0;
    msgVisible.value = true;
    msgTimer = window.setInterval(() => {
      msgVisible.value = false;
      msgFadeTimer = window.setTimeout(() => {
        msgIndex.value = (msgIndex.value + 1) % messages.length;
        msgVisible.value = true;
      }, 500);
    }, 5000);
  }
});

onUnmounted(stopWaitingTimers);
</script>

<template>
  <div class="shell">
    <!-- 顶栏 + 步骤进度条 -->
    <header class="topwrap">
      <div class="topbar">
        <span class="brand">CPU • Words2Site</span>
        <span class="step"
          >步骤 {{ stepIndex }} / {{ STEPS.length }} · {{ stepLabel }}</span
        >
      </div>
      <div class="progress-top">
        <div
          class="progress-top-fill"
          :style="{ width: progressPct + '%' }"
        ></div>
      </div>
    </header>

    <!-- ① 欢迎 -->
    <main v-if="step === 'intro'" class="screen">
      <h1 class="hero-title">一句话，生成你的网页</h1>
      <p class="hero-sub">对 AI 说说你想要的网页<br />几分钟后它才是真的了</p>

      <div class="card steps-card">
        <div class="step-row">
          <span class="step-num">1</span>对着麦克风描述你想要的网页
        </div>
        <div class="step-row">
          <span class="step-num">2</span>AI 现场为你生成网页
        </div>
        <div class="step-row">
          <span class="step-num">3</span>发布并获得集章凭证
        </div>
      </div>

      <button class="btn-primary" type="button" @click="step = 'record'">
        开始体验
      </button>
    </main>

    <!-- ② 描述网页 -->
    <main v-else-if="step === 'record'" class="screen">
      <div class="tabs">
        <button
          class="tab"
          :class="inputMode === 'voice' ? 'tab-active' : 'tab-idle'"
          type="button"
          @click="inputMode = 'voice'"
        >
          语音
        </button>
        <button
          class="tab"
          :class="inputMode === 'typing' ? 'tab-active' : 'tab-idle'"
          type="button"
          @click="inputMode = 'typing'"
        >
          打字
        </button>
      </div>

      <template v-if="inputMode === 'voice'">
        <div v-if="transcript" class="mic-card">
          <span class="mic-circle">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="#1C1917"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="mic-svg"
            >
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" x2="12" y1="19" y2="22" />
            </svg>
          </span>
          <span class="mic-text">
            <span class="mic-title">录音完成</span>
            <span class="mic-sub">{{ recordedSeconds }}″ · 已转成文字</span>
          </span>
        </div>
        <RecorderPanel v-else @transcribed="onTranscribed" />
      </template>

      <!-- 打字模式始终可编辑；语音模式下录制完成后才出现识别结果卡 -->
      <div v-if="inputMode === 'typing' || transcript" class="card edit-card">
        <p v-if="inputMode === 'voice'" class="edit-label">
          语音识别结果（可直接修改）：
        </p>
        <textarea
          v-model="draft"
          class="edit-area"
          :placeholder="
            inputMode === 'voice'
              ? ''
              : '描述你想要的网页，比如：做一个介绍我家猫咪的网页，粉色可爱风，要有它的照片墙…'
          "
        ></textarea>
        <p class="edit-count">{{ draft.length }} / 300</p>
      </div>

      <p v-if="submitError" class="err-text">{{ submitError }}</p>

      <button
        class="btn-primary"
        type="button"
        :disabled="draft.trim().length < 10 || draft.length > 300"
        @click="step = 'info'"
      >
        下一步 →
      </button>
      <button class="btn-outline" type="button" @click="redoRecord">
        重新说
      </button>
    </main>

    <!-- ③ 填写信息 -->
    <main v-else-if="step === 'info'" class="screen screen-info">
      <h2 class="page-title">填写信息</h2>
      <p class="page-sub">邮箱用于接收网页链接和集章凭证</p>

      <label class="field-label" for="w2s-email"
        >邮箱（接收网页链接和集章凭证）</label
      >
      <input
        id="w2s-email"
        v-model="email"
        class="field-input"
        type="email"
        inputmode="email"
        autocapitalize="off"
        autocorrect="off"
        placeholder="name@example.com"
      />

      <label class="field-label" for="w2s-domain">为你的网页选个网址</label>
      <input
        id="w2s-domain"
        v-model="domainLabel"
        class="field-input"
        type="text"
        autocapitalize="off"
        autocorrect="off"
        spellcheck="false"
        placeholder="my-cat"
      />
      <p v-if="domainLabel" class="url-preview">
        你的网址：https://{{ domainLabel }}{{ domainSuffix }}/
      </p>

      <label class="cb-card">
        <input v-model="isPublic" class="cb-native" type="checkbox" />
        <span class="cb-row">
          <span class="cb-box" :class="{ 'cb-box-on': isPublic }">
            <Check v-if="isPublic" class="cb-check" :stroke-width="3.5" />
          </span>
          <span class="cb-title">上大屏展示</span>
        </span>
        <span class="cb-desc"
          >勾选后你的网页会出现在现场大屏上滚动展示；不勾选仅自己通过链接访问</span
        >
      </label>

      <div class="bottom-bar">
        <p v-if="submitError" class="err-text">{{ submitError }}</p>
        <button
          class="btn-primary"
          type="button"
          :disabled="
            submitting ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim()) ||
            !/^[a-z0-9][a-z0-9-]{2,30}$/.test(domainLabel.trim())
          "
          @click="submitTask"
        >
          {{ submitting ? "提交中…" : "让 AI 生成！" }}
        </button>
      </div>
    </main>

    <!-- ④ 生成中 / ⑤ 卡住了 -->
    <main v-else-if="step === 'waiting'" class="screen screen-waiting">
      <div class="logo-wrap">
        <span class="logo-halo"></span>
        <span class="logo-circle"><CpuLogo class="logo-mark" /></span>
      </div>

      <template v-if="!failed">
        <h2 class="wait-title">{{ waitingTitle }}</h2>
        <div class="ai-bar">
          <div class="ai-bar-fill" :style="{ width: waitProgress + '%' }"></div>
        </div>
        <div class="msg-zone">
          <p class="msg" :class="{ 'msg-show': msgVisible }">
            {{ messages[msgIndex] }}
          </p>
        </div>
      </template>

      <template v-else>
        <h2 class="wait-title fail-title">啊哦，卡住了</h2>
        <button
          class="btn-primary"
          type="button"
          :disabled="submitting"
          @click="submitTask"
        >
          点击刷新
        </button>
        <button class="btn-dashed" type="button">找工作人员帮忙</button>
        <p class="err-code">
          错误码 · {{ status?.error || "W2S-GEN-TIMEOUT" }}
        </p>
      </template>
    </main>

    <!-- ⑥ 预览 -->
    <main v-else-if="step === 'preview'" class="screen">
      <h2 class="section-title">你的网页已经准备好啦</h2>
      <PreviewFrame :task-id="taskId" :version="htmlVersion" />

      <p v-if="submitError" class="err-text">{{ submitError }}</p>
      <button
        class="btn-primary gap-top"
        type="button"
        :disabled="publishing"
        @click="publish"
      >
        {{ publishing ? "发布中…" : "满意，发布我的网页！" }}
      </button>

      <div
        v-if="(status?.refinements ?? 0) < (status?.maxRefine ?? 2)"
        class="card refine-card"
      >
        <p class="refine-label">想改改？告诉 AI 哪里不满意</p>
        <textarea
          v-model="refineText"
          class="refine-area"
          placeholder="例如：换主色调、加一个段落、改标题"
        ></textarea>
        <p v-if="refineError" class="err-text">{{ refineError }}</p>
        <button
          class="btn-dark"
          type="button"
          :disabled="refining || refineText.trim().length < 2"
          @click="submitRefine"
        >
          {{ refining ? "提交中…" : "提交修改" }}
        </button>
      </div>
      <p v-else class="refine-used">修改次数已用完 ~</p>
    </main>

    <!-- ⑦ 凭证 -->
    <main v-else-if="step === 'certificate' && cert" class="screen">
      <h2 class="done-title">网页发布成功！</h2>
      <CertificateCard
        :code="cert.code"
        :publish-url="cert.publishUrl"
        :verify-url="cert.verifyUrl"
        :domain="cert.domain"
        :email="cert.email"
      />
      <button class="again-link" type="button" @click="restart">
        帮朋友也做一个 →
      </button>
    </main>
  </div>
</template>

<style scoped>
/* ===== 版式 ===== */
.shell {
  width: 100%;
  max-width: 375px;
  min-height: 100dvh;
  margin: 0 auto;
  background: #fff;
}

.topwrap {
  position: sticky;
  top: 0;
  z-index: 20;
  background: #fff;
  padding-top: max(29px, env(safe-area-inset-top));
}

.topbar {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 0 16px 3px;
}
.brand {
  font-size: 12.5px;
  font-weight: 800;
  letter-spacing: 0.02em;
  color: #1c1917;
}
.step {
  font-size: 10px;
  color: #a8a29e;
}

.progress-top {
  height: 4px;
  background: #efefec;
}
.progress-top-fill {
  height: 100%;
  background: #f7d447;
  transition: width 0.3s ease;
}

.screen {
  padding: 0 16px 40px;
}
.screen-info {
  padding-bottom: 120px;
}

/* ===== 通用元素 ===== */
.card {
  background: #fff;
  border: 1px solid #eeede9;
  border-radius: 14px;
}

.btn-primary {
  width: 100%;
  height: 54px;
  border: 0;
  border-radius: 12px;
  background: #f7d447;
  color: #1c1917;
  font-size: 16px;
  font-weight: 700;
  transition:
    transform 0.12s ease,
    background-color 0.15s ease;
}
.btn-primary:active:not(:disabled) {
  transform: scale(0.985);
}
.btn-primary:disabled {
  background: #efefec;
  color: #a8a29e;
}

.btn-outline {
  width: 100%;
  height: 50px;
  margin-top: 15px;
  border: 1px solid #e7e5e0;
  border-radius: 12px;
  background: #fff;
  color: #1c1917;
  font-size: 14px;
}

.btn-dashed {
  width: 100%;
  height: 51px;
  margin-top: 19px;
  border: 1px dashed #1c1917;
  border-radius: 12px;
  background: #fff;
  color: #1c1917;
  font-size: 14px;
}

.btn-dark {
  width: 100%;
  height: 40px;
  border: 0;
  border-radius: 10px;
  background: #1c1917;
  color: #f7d447;
  font-size: 14px;
  font-weight: 700;
}
.btn-dark:disabled {
  opacity: 0.45;
}

.err-text {
  margin-top: 10px;
  font-size: 12px;
  line-height: 1.6;
  color: #cf3a26;
}
.gap-top {
  margin-top: 25px;
}

/* ===== ① 欢迎 ===== */
.hero-title {
  margin-top: 55px;
  font-size: 24px;
  font-weight: 800;
  line-height: 1.25;
  text-align: center;
  color: #1c1917;
}
.hero-sub {
  margin-top: 8px;
  font-size: 14px;
  line-height: 20px;
  text-align: center;
  color: #78716c;
}

.steps-card {
  height: 190px;
  margin-top: 54px;
  padding: 18px 20px;
}
.step-row {
  display: flex;
  align-items: center;
  gap: 11px;
  height: 40px;
  font-size: 14px;
  color: #1c1917;
}
.step-num {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: #fef3c7;
  font-size: 12px;
  font-weight: 700;
  color: #1c1917;
}
.steps-card + .btn-primary {
  margin-top: 70px;
}

/* ===== ② 描述网页 ===== */
.tabs {
  display: flex;
  gap: 12px;
  margin-top: 37px;
}
.tab {
  flex: 1;
  height: 40px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
}
.tab-active {
  border: 1px solid #f7d447;
  background: #f7d447;
  color: #1c1917;
}
.tab-idle {
  border: 1px solid #e7e5e0;
  background: #fff;
  color: #57534e;
}

.mic-card {
  display: flex;
  align-items: center;
  gap: 14px;
  height: 80px;
  margin-top: 24px;
  padding: 0 18px;
  border: 1px solid #f9e17e;
  border-radius: 14px;
  background: #fef3c7;
}
.mic-circle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: #f7d447;
  flex: 0 0 auto;
}
.mic-svg {
  width: 22px;
  height: 22px;
}
.mic-text {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.mic-title {
  font-size: 14px;
  font-weight: 700;
  color: #1c1917;
}
.mic-sub {
  font-size: 11.5px;
  color: #78716c;
}

.edit-card {
  margin-top: 19px;
  padding: 18px;
}
.edit-label {
  margin-bottom: 10px;
  font-size: 13px;
  font-weight: 700;
  color: #1c1917;
}
.edit-area {
  display: block;
  width: 100%;
  min-height: 96px;
  border: 0;
  outline: none;
  resize: none;
  background: transparent;
  font-size: 14px;
  line-height: 1.7;
  color: #1c1917;
}
.edit-area::placeholder {
  color: #a8a29e;
}
.edit-count {
  margin-top: 6px;
  font-size: 12px;
  text-align: right;
  color: #a8a29e;
}
.edit-card + .btn-primary,
.edit-card + .err-text + .btn-primary {
  margin-top: 34px;
}

/* ===== ③ 填写信息 ===== */
.page-title {
  margin-top: 65px;
  font-size: 20px;
  font-weight: 800;
  color: #1c1917;
}
.page-sub {
  margin-top: 6px;
  font-size: 11.5px;
  color: #78716c;
}
.field-label {
  display: block;
  margin-top: 44px;
  font-size: 11.5px;
  font-weight: 700;
  color: #1c1917;
}
.field-input {
  width: 100%;
  height: 48px;
  margin-top: 5px;
  padding: 0 18px;
  border: 1px solid #eeede9;
  border-radius: 12px;
  background: #fff;
  font-size: 15px;
  color: #1c1917;
  outline: none;
}
.field-input::placeholder {
  color: #a8a29e;
}
.field-input:focus {
  border-color: #f7d447;
}
.url-preview {
  margin-top: 15px;
  padding-left: 18px;
  font-size: 11px;
  color: #78716c;
}

.cb-card {
  display: block;
  margin-top: 12px;
  padding: 18px 16px;
  border: 1px solid #eeede9;
  border-radius: 12px;
  background: #fff;
  cursor: pointer;
}
.cb-native {
  display: none;
}
.cb-row {
  display: flex;
  align-items: center;
  gap: 13px;
}
.cb-box {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border: 1px solid #d6d3d1;
  border-radius: 6px;
  background: #fff;
  flex: 0 0 auto;
}
.cb-box-on {
  border-color: #1c1917;
  background: #1c1917;
}
.cb-check {
  width: 13px;
  height: 13px;
  color: #f7d447;
}
.cb-title {
  font-size: 13px;
  font-weight: 700;
  color: #1c1917;
}
.cb-desc {
  display: block;
  margin-top: 8px;
  font-size: 11.5px;
  line-height: 15px;
  color: #78716c;
}

.bottom-bar {
  position: fixed;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  max-width: 375px;
  padding: 0 16px calc(24px + env(safe-area-inset-bottom));
  background: #fff;
}

/* ===== ④ 生成中 / ⑤ 卡住了 ===== */
.screen-waiting {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 205px;
}
.logo-wrap {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 160px;
  height: 160px;
  animation: breathe 2.6s ease-in-out infinite;
}
.logo-halo {
  position: absolute;
  inset: -14px;
  border: 2px solid rgba(247, 212, 71, 0.55);
  border-radius: 50%;
  animation: halo 2.6s ease-out infinite;
}
.logo-circle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 160px;
  height: 160px;
  border-radius: 50%;
  background: #f7d447;
  animation: floaty 3.2s ease-in-out infinite;
}
.logo-mark {
  width: 78px;
  height: 74px;
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
  margin-top: 22px;
  font-size: 17px;
  font-weight: 700;
  line-height: 1.2;
  text-align: center;
  color: #1c1917;
}
.fail-title {
  font-size: 19px;
}
.ai-bar {
  width: 200px;
  height: 6px;
  margin-top: 18px;
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
  width: 300px;
  min-height: 46px;
  margin-top: 7px;
  text-align: center;
}
.msg {
  font-size: 12.5px;
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

.screen-waiting .btn-primary {
  width: 343px;
  margin-top: 31px;
}
.screen-waiting .btn-dashed {
  width: 343px;
}
.err-code {
  margin-top: 26px;
  font-size: 11px;
  color: #a8a29e;
}

/* ===== ⑥ 预览 ===== */
.section-title {
  margin-top: 28px;
  font-size: 14px;
  font-weight: 700;
  color: #1c1917;
}
.section-title + * {
  margin-top: 15px;
}
.refine-card {
  margin-top: 25px;
  padding: 16px;
}
.refine-label {
  font-size: 13px;
  font-weight: 700;
  color: #1c1917;
}
.refine-area {
  display: block;
  width: 100%;
  height: 80px;
  margin-top: 12px;
  padding: 10px 12px;
  border: 1px solid #e7e5e0;
  border-radius: 10px;
  background: #fafaf7;
  font-size: 13px;
  line-height: 1.6;
  color: #1c1917;
  outline: none;
  resize: none;
}
.refine-area::placeholder {
  color: #a8a29e;
}
.refine-card .btn-dark {
  margin-top: 20px;
}
.refine-used {
  margin-top: 25px;
  font-size: 12px;
  text-align: center;
  color: #a8a29e;
}

/* ===== ⑦ 完成 ===== */
.done-title {
  margin-top: 24px;
  font-size: 22px;
  font-weight: 800;
  text-align: center;
  color: #1c1917;
}
.again-link {
  display: block;
  width: 100%;
  margin-top: 32px;
  border: 0;
  background: none;
  font-size: 14px;
  color: #1c1917;
}
</style>
