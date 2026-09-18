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

type Step = "intro" | "record" | "info" | "waiting" | "done";

const STEPS: { key: Step; label: string }[] = [
  { key: "intro", label: "欢迎" },
  { key: "record", label: "描述网页" },
  { key: "info", label: "填写信息" },
  { key: "waiting", label: "生成中" },
  { key: "done", label: "完成" },
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
const stepNum = computed(() => String(stepIndex.value).padStart(2, "0"));
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
      step.value = "done";
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
    <!-- 顶部：左上角标（点回现场大屏）+ 右对齐空心标题 -->
    <header class="hero">
      <RouterLink
        to="/"
        class="badge"
        aria-label="返回现场大屏"
        title="返回现场大屏"
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
        <span class="sheet-step"
          >步骤 {{ stepIndex }} / {{ STEPS.length }}</span
        >
      </div>
      <div class="sheet-track">
        <div class="sheet-fill" :style="{ width: progressPct + '%' }"></div>
      </div>

      <div class="sheet-body">
        <!-- ① 欢迎 -->
        <template v-if="step === 'intro'">
          <h2 class="hero-h">一句话，生成你的网页</h2>
          <p class="hero-sub2">
            对 AI 说说你想要的网页<br />几分钟后它才是真的了
          </p>

          <div class="howto">
            <div
              v-for="(r, i) in [
                ['1', '对着麦克风描述你想要的网页'],
                ['2', 'AI 现场为你生成网页'],
                ['3', '发布并获得集章凭证'],
              ]"
              :key="i"
              class="howto-row"
            >
              <span class="howto-num">{{ r[0] }}</span>
              <span class="howto-txt">{{ r[1] }}</span>
            </div>
          </div>

          <button class="btn-ink" type="button" @click="step = 'record'">
            开始体验
          </button>
        </template>

        <!-- ② 描述网页 -->
        <template v-else-if="step === 'record'">
          <div class="tabs">
            <button
              class="tab"
              :class="{ 'tab-on': inputMode === 'voice' }"
              type="button"
              @click="inputMode = 'voice'"
            >
              语音
            </button>
            <button
              class="tab"
              :class="{ 'tab-on': inputMode === 'typing' }"
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
                  <path
                    d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"
                  />
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
          <div v-if="inputMode === 'typing' || transcript" class="edit-card">
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
            class="btn-ink"
            type="button"
            :disabled="draft.trim().length < 10 || draft.length > 300"
            @click="step = 'info'"
          >
            下一步
          </button>
          <button class="btn-ghost" type="button" @click="redoRecord">
            重新说
          </button>
        </template>

        <!-- ③ 填写信息 -->
        <template v-else-if="step === 'info'">
          <div class="flabel">邮箱（接收网页链接和集章凭证）</div>
          <input
            v-model="email"
            class="field-input"
            type="email"
            inputmode="email"
            autocapitalize="off"
            autocorrect="off"
            placeholder="name@example.com"
          />

          <div class="flabel">为你的网页选个网址</div>
          <input
            v-model="domainLabel"
            class="field-input"
            type="text"
            autocapitalize="off"
            autocorrect="off"
            spellcheck="false"
            placeholder="my-cat"
          />
          <p v-if="domainLabel" class="url-preview">
            你的网址：https://<mark>{{ domainLabel }}</mark
            >{{ domainSuffix }}/
          </p>

          <label class="pub-card">
            <input v-model="isPublic" class="cb-native" type="checkbox" />
            <span class="pub-row">
              <span class="pub-box" :class="{ 'pub-box-on': isPublic }">
                <Check v-if="isPublic" class="pub-check" :stroke-width="3" />
              </span>
              <span class="pub-title">上大屏展示</span>
            </span>
            <span class="pub-desc"
              >勾选后你的网页会出现在现场大屏上滚动展示；<br />不勾选仅自己通过链接访问</span
            >
          </label>

          <p v-if="submitError" class="err-text">{{ submitError }}</p>
          <button
            class="btn-ink"
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
        </template>

        <!-- ④ 生成中 / 卡住了 -->
        <template v-else-if="step === 'waiting'">
          <div class="wait-wrap">
            <div class="logo-wrap">
              <span class="logo-halo"></span>
              <span class="logo-circle"
                ><CpuLogo class="logo-mark" ink="#FAF7E8"
              /></span>
            </div>

            <template v-if="!failed">
              <h2 class="wait-title">{{ waitingTitle }}</h2>
              <div class="ai-bar">
                <div
                  class="ai-bar-fill"
                  :style="{ width: waitProgress + '%' }"
                ></div>
              </div>
              <div class="msg-zone">
                <p class="msg" :class="{ 'msg-show': msgVisible }">
                  {{ messages[msgIndex] }}
                </p>
              </div>
            </template>

            <template v-else>
              <h2 class="wait-title">啊哦，卡住了</h2>
              <button
                class="btn-ink btn-narrow no-arrow"
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
          </div>
        </template>

        <!-- ⑤ 完成：先预览+发布，发布后出凭证 -->
        <template v-else-if="step === 'done'">
          <template v-if="!cert">
            <PreviewFrame :task-id="taskId" :version="htmlVersion" />

            <p v-if="submitError" class="err-text">{{ submitError }}</p>
            <button
              class="btn-ink"
              type="button"
              :disabled="publishing"
              @click="publish"
            >
              {{ publishing ? "发布中…" : "满意，发布我的网页！" }}
            </button>

            <div
              v-if="(status?.refinements ?? 0) < (status?.maxRefine ?? 2)"
              class="refine-card"
            >
              <p class="refine-label">想改改？告诉 AI 哪里不满意</p>
              <textarea
                v-model="refineText"
                class="refine-area"
                placeholder="例如：换主色调、加一个段落、改标题"
              ></textarea>
              <p v-if="refineError" class="err-text">{{ refineError }}</p>
              <button
                class="btn-ink btn-slim"
                type="button"
                :disabled="refining || refineText.trim().length < 2"
                @click="submitRefine"
              >
                {{ refining ? "提交中…" : "提交修改" }}
              </button>
            </div>
            <p v-else class="refine-used">修改次数已用完 ~</p>
          </template>

          <template v-else>
            <h2 class="done-title">网页发布成功！</h2>
            <CertificateCard
              :code="cert.code"
              :publish-url="cert.publishUrl"
              :verify-url="cert.verifyUrl"
              :domain="cert.domain"
              :email="cert.email"
            />
            <button class="btn-ghost" type="button" @click="restart">
              帮朋友也做一个 →
            </button>
          </template>
        </template>
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

/* ===== 通用按钮 ===== */
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
.btn-slim {
  height: 40px;
  margin-top: 16px;
}
.btn-narrow {
  display: block;
  width: 200px;
  margin: 22px auto 0;
}
.btn-ghost {
  width: 100%;
  height: 44px;
  margin-top: 16px;
  border: 2px solid #1c1917;
  border-radius: 4px;
  background: #ffffff;
  color: #1c1917;
  font-size: 12.5px;
  font-weight: 700;
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

.err-text {
  margin-top: 10px;
  font-size: 11px;
  line-height: 1.6;
  color: #b42318;
}

/* ===== ① 欢迎 ===== */
.hero-h {
  font-size: 20px;
  font-weight: 900;
  color: #1c1917;
}
.hero-sub2 {
  margin-top: 8px;
  font-size: 11.5px;
  line-height: 16px;
  color: rgba(28, 25, 23, 0.68);
}
.howto {
  margin-top: 18px;
}
.howto-row {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 44px;
  margin-bottom: 8px;
  padding: 0 12px;
  border: 2px solid #1c1917;
  border-radius: 4px;
  background: #fdf4d6;
}
.howto-row:last-child {
  margin-bottom: 0;
}
.howto-num {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 3px;
  background: #1c1917;
  font-size: 12px;
  font-weight: 900;
  color: #f7d447;
  flex: 0 0 auto;
}
.howto-txt {
  font-size: 11.5px;
  font-weight: 700;
  color: #1c1917;
}

/* ===== ② 描述网页 ===== */
.tabs {
  display: flex;
  width: 140px;
  height: 34px;
  padding: 3px;
  border: 2px solid #1c1917;
  border-radius: 4px;
  background: #f1efe8;
}
.tab {
  flex: 1;
  border: 0;
  border-radius: 3px;
  background: none;
  font-size: 11.5px;
  font-weight: 800;
  color: rgba(28, 25, 23, 0.6);
}
.tab-on {
  background: #1c1917;
  color: #f7d447;
}

.mic-card {
  display: flex;
  align-items: center;
  gap: 13px;
  height: 62px;
  margin-top: 14px;
  padding: 0 12px;
  border: 2px solid #1c1917;
  border-radius: 4px;
  background: #fdf4d6;
}
.mic-circle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: #f7d447;
  border: 2px solid #1c1917;
  flex: 0 0 auto;
  box-sizing: border-box;
}
.mic-svg {
  width: 17px;
  height: 17px;
}
.mic-text {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.mic-title {
  font-size: 12px;
  font-weight: 700;
  color: #1c1917;
}
.mic-sub {
  font-size: 10.5px;
  color: rgba(28, 25, 23, 0.6);
}

.edit-card {
  margin-top: 12px;
  padding: 12px 14px 10px;
  border: 2px solid #1c1917;
  border-radius: 4px;
  background: #ffffff;
}
.edit-label {
  margin-bottom: 8px;
  font-size: 10px;
  color: rgba(28, 25, 23, 0.55);
}
.edit-area {
  display: block;
  width: 100%;
  min-height: 76px;
  border: 0;
  outline: none;
  resize: none;
  background: transparent;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.6;
  color: #1c1917;
}
.edit-area::placeholder {
  font-weight: 400;
  color: rgba(28, 25, 23, 0.4);
}
.edit-count {
  margin-top: 4px;
  font-family: Consolas, Menlo, ui-monospace, monospace;
  font-size: 9.5px;
  text-align: right;
  color: rgba(28, 25, 23, 0.45);
}

/* ===== ③ 填写信息 ===== */
.flabel {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 20px;
  font-size: 11px;
  font-weight: 700;
  color: #1c1917;
}
.flabel::before {
  content: "";
  width: 10px;
  height: 10px;
  border: 2px solid #1c1917;
  background: #f7d447;
  box-sizing: border-box;
  flex: 0 0 auto;
}
.sheet-body > .flabel:first-child {
  margin-top: 0;
}
.field-input {
  width: 100%;
  height: 46px;
  margin-top: 7px;
  padding: 0 14px;
  border: 2px solid #1c1917;
  border-radius: 4px;
  background: #ffffff;
  font-size: 13px;
  color: #1c1917;
  outline: none;
  box-sizing: border-box;
}
.field-input::placeholder {
  color: rgba(28, 25, 23, 0.35);
}
.field-input:focus {
  box-shadow: 3px 3px 0 #1c1917;
}
.url-preview {
  margin-top: 12px;
  font-family: Consolas, Menlo, ui-monospace, monospace;
  font-size: 10.5px;
  color: #1c1917;
  word-break: break-all;
}
.url-preview mark {
  padding: 0 1px;
  background: #f7d447;
  color: #1c1917;
}

.pub-card {
  display: block;
  margin-top: 18px;
  padding: 14px 14px 12px;
  border-radius: 4px;
  background: #1c1917;
  cursor: pointer;
}
.cb-native {
  display: none;
}
.pub-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.pub-box {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border: 1.5px solid rgba(250, 247, 232, 0.5);
  border-radius: 4px;
  background: rgba(250, 247, 232, 0.08);
  flex: 0 0 auto;
}
.pub-box-on {
  border-color: #f7d447;
  background: #f7d447;
}
.pub-check {
  width: 13px;
  height: 13px;
  color: #1c1917;
}
.pub-title {
  font-size: 12px;
  font-weight: 800;
  color: #faf7e8;
}
.pub-desc {
  display: block;
  margin-top: 8px;
  font-size: 9.5px;
  line-height: 14px;
  color: rgba(250, 247, 232, 0.75);
}

/* ===== ④ 生成中 / 卡住了 ===== */
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

/* ===== ⑤ 完成 ===== */
.done-title {
  font-size: 18px;
  font-weight: 900;
  text-align: center;
  color: #1c1917;
}
.refine-card {
  margin-top: 20px;
  padding: 14px;
  border: 2px solid #1c1917;
  border-radius: 4px;
  background: #ffffff;
}
.refine-label {
  font-size: 12px;
  font-weight: 700;
  color: #1c1917;
}
.refine-area {
  display: block;
  width: 100%;
  height: 72px;
  margin-top: 10px;
  padding: 10px 12px;
  border: 1.5px solid rgba(28, 25, 23, 0.35);
  border-radius: 3px;
  background: #fdf4d6;
  font-size: 12px;
  line-height: 1.6;
  color: #1c1917;
  outline: none;
  resize: none;
  box-sizing: border-box;
}
.refine-area::placeholder {
  color: rgba(28, 25, 23, 0.4);
}
.refine-used {
  margin-top: 18px;
  font-size: 11px;
  text-align: center;
  color: rgba(28, 25, 23, 0.5);
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
</style>
