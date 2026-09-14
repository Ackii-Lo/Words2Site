<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { api, type TaskStatus } from "@/composables/useApi";
import { useTaskPolling } from "@/composables/useTaskPolling";
import { deviceId } from "@/lib/utils";
import Button from "@/components/ui/Button.vue";
import Card from "@/components/ui/Card.vue";
import Textarea from "@/components/ui/Textarea.vue";
import Badge from "@/components/ui/Badge.vue";
import RecorderPanel from "@/components/RecorderPanel.vue";
import PreviewFrame from "@/components/PreviewFrame.vue";
import CertificateCard from "@/components/CertificateCard.vue";
import {
  Mic,
  Keyboard,
  Globe,
  ArrowRight,
  Pencil,
  Rocket,
  RotateCcw,
  Bot,
  ThumbsUp,
  PenLine,
  RefreshCw,
  Plus,
  AtSign,
  Eye,
} from "lucide-vue-next";

type Step = "intro" | "record" | "confirm" | "info" | "waiting" | "preview" | "certificate";

const step = ref<Step>("intro");
const transcript = ref("");
const draft = ref("");
const email = ref("");
const domainLabel = ref("");
const isPublic = ref(true);
const domainSuffix = ref(".unnc.space"); // 与服务端 DEPLOY_DOMAIN_TEMPLATE 对应
const inputMode = ref<"voice" | "typing">("voice");
const submitting = ref(false);
const submitError = ref("");
const taskId = ref("");
const htmlVersion = ref(0);
const cert = ref<{ code: string; publishUrl: string | null; verifyUrl: string; domain: string | null; email: string | null } | null>(null);
const publishing = ref(false);

const { status, start: startPolling } = useTaskPolling();

const onTranscribed = (text: string) => {
  transcript.value = text;
  draft.value = text;
  step.value = "confirm";
};

watch(
  () => status.value?.status,
  (s) => {
    if (s === "done") {
      htmlVersion.value++;
      step.value = "preview";
    }
  },
);

async function submitTask() {
  const text = draft.value.trim();
  if (text.length < 10) {
    submitError.value = "描述太短啦,至少 10 个字";
    step.value = "confirm";
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
  try {
    const data = await api<{ publishUrl: string; code: string }>(
      `/api/tasks/${taskId.value}/publish`,
      { method: "POST" },
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
  email.value = "";
  domainLabel.value = "";
  isPublic.value = true;
  taskId.value = "";
  cert.value = null;
  refineText.value = "";
  submitError.value = "";
}

const waitingText = computed(() => {
  const s = status.value;
  if (!s) return "排队中…";
  if (s.status === "queued") return s.queuePosition > 0 ? `前面还有 ${s.queuePosition} 位` : "马上就到你了…";
  return s.stage || "AI 正在搭建你的网页…";
});

const waitElapsed = ref(0);
let waitTimer: ReturnType<typeof setInterval> | null = null;
watch(step, (s) => {
  if (s === "waiting") {
    waitElapsed.value = 0;
    waitTimer = setInterval(() => (waitElapsed.value += 1), 1000);
  } else if (waitTimer) {
    clearInterval(waitTimer);
    waitTimer = null;
  }
});

const funFacts = [
  "AI 正在一块块搬砖砌你的网页…",
  "正在挑选合适的配色方案…",
  "帮你的网页加上一点魔法…",
  "正在适配你的手机屏幕…",
  "马上就好,网页马上起飞…",
];
const funFact = computed(() => funFacts[waitElapsed.value % funFacts.length]);
</script>

<template>
  <div class="mx-auto min-h-dvh w-full max-w-lg px-4 pb-16 pt-10">
    <!-- 顶部 -->
    <header class="mb-8 text-center">
      <div class="flex items-center justify-center gap-2 text-primary">
        <Mic class="h-9 w-9" />
        <ArrowRight class="h-5 w-5 text-muted-foreground" />
        <Globe class="h-9 w-9" />
      </div>
      <h1 class="mt-2 text-2xl font-bold">一句话,生成你的网页</h1>
      <p v-if="step === 'intro'" class="mt-2 text-sm text-muted-foreground">
        对 AI 说说你想要的网页,几分钟后它就是真的了
      </p>
    </header>

    <!-- ① 首页 -->
    <template v-if="step === 'intro'">
      <Card class="space-y-5 p-6">
        <div class="space-y-3 text-sm text-muted-foreground">
          <div class="flex items-center gap-3">
            <span class="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">1</span>
            对着麦克风描述你想要的网页
          </div>
          <div class="flex items-center gap-3">
            <span class="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">2</span>
            AI 现场为你生成网页
          </div>
          <div class="flex items-center gap-3">
            <span class="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">3</span>
            发布并获得集章凭证
          </div>
        </div>
        <Button size="xl" class="w-full" @click="step = 'record'">开始体验</Button>
      </Card>
    </template>

    <!-- ② 录音 -->
    <template v-else-if="step === 'record'">
      <div class="mb-4 flex justify-center gap-2">
        <Button :variant="inputMode === 'voice' ? 'default' : 'outline'" size="sm" @click="inputMode = 'voice'">
          <Mic class="h-4 w-4" /> 语音
        </Button>
        <Button :variant="inputMode === 'typing' ? 'default' : 'outline'" size="sm" @click="inputMode = 'typing'">
          <Keyboard class="h-4 w-4" /> 打字
        </Button>
      </div>

      <RecorderPanel v-if="inputMode === 'voice'" @transcribed="onTranscribed" />
      <Card v-else class="space-y-4 p-6">
        <Textarea
          v-model="draft"
          placeholder="描述你想要的网页,比如:做一个介绍我家猫咪的网页,粉色可爱风,要有它的照片墙…"
          class="min-h-40 text-base"
        />
        <p class="text-right text-xs text-muted-foreground">{{ draft.length }} / 300</p>
        <Button size="lg" class="w-full" :disabled="draft.trim().length < 10" @click="step = 'confirm'">下一步</Button>
      </Card>
    </template>

    <!-- ③ 确认描述 -->
    <template v-else-if="step === 'confirm'">
      <Card class="space-y-4 p-6">
        <div class="flex items-center justify-between">
          <h2 class="flex items-center gap-2 font-semibold"><Pencil class="h-4 w-4" /> 确认一下你的想法</h2>
          <Badge variant="secondary">可编辑</Badge>
        </div>
        <p v-if="transcript" class="flex items-center gap-1 text-xs text-muted-foreground">
          <Mic class="h-3 w-3" /> 语音识别结果(可直接修改):
        </p>
        <Textarea v-model="draft" class="min-h-40 text-base" />
        <p class="text-right text-xs" :class="draft.length > 300 || draft.trim().length < 10 ? 'text-destructive' : 'text-muted-foreground'">
          {{ draft.length }} / 300(至少 10 字)
        </p>
        <p v-if="submitError" class="text-sm text-destructive">{{ submitError }}</p>
        <Button size="xl" class="w-full" :disabled="draft.trim().length < 10 || draft.length > 300" @click="step = 'info'">
          <ArrowRight class="h-5 w-5" /> 下一步
        </Button>
        <Button variant="ghost" class="w-full" @click="restart"><RotateCcw class="h-4 w-4" /> 重新说</Button>
      </Card>
    </template>

    <!-- ③b 邮箱 + 域名 + 公开设置 -->
    <template v-else-if="step === 'info'">
      <Card class="space-y-5 p-6">
        <h2 class="flex items-center gap-2 font-semibold"><AtSign class="h-4 w-4" /> 填写邮箱,给自己的网页选个网址</h2>

        <div>
          <label class="mb-1 block text-sm text-muted-foreground">邮箱(接收网页链接和集章凭证)</label>
          <input
            v-model="email"
            type="email"
            inputmode="email"
            placeholder="you@example.com"
            class="h-12 w-full rounded-lg border bg-card px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <div>
          <label class="mb-1 block text-sm text-muted-foreground">网址(只能用小写字母、数字、连字符)</label>
          <div class="flex items-stretch overflow-hidden rounded-lg border bg-card focus-within:ring-2 focus-within:ring-ring">
            <input
              v-model="domainLabel"
              placeholder="my-cat"
              autocapitalize="off"
              autocorrect="off"
              class="h-12 flex-1 px-3 font-mono text-base focus-visible:outline-none"
            />
            <span class="flex items-center bg-muted px-3 font-mono text-sm text-muted-foreground">{{ domainSuffix }}</span>
          </div>
          <p v-if="domainLabel" class="mt-1 text-xs text-muted-foreground">
            你的网址:https://{{ domainLabel }}{{ domainSuffix }}/
          </p>
        </div>

        <label class="flex cursor-pointer items-start gap-3 rounded-xl border p-4" :class="isPublic ? 'border-primary/40 bg-primary/5' : ''">
          <input v-model="isPublic" type="checkbox" class="mt-1 h-5 w-5 accent-[var(--primary)]" />
          <span>
            <span class="flex items-center gap-1.5 text-sm font-medium"><Eye class="h-4 w-4" /> 上大屏展示</span>
            <span class="mt-0.5 block text-xs text-muted-foreground">
              勾选后你的网页会出现在现场大屏上滚动展示;不勾选仅自己通过链接访问
            </span>
          </span>
        </label>

        <p v-if="submitError" class="text-sm text-destructive">{{ submitError }}</p>
        <Button
          size="xl"
          class="w-full"
          :disabled="submitting || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim()) || !/^[a-z0-9][a-z0-9-]{2,30}$/.test(domainLabel.trim())"
          @click="submitTask"
        >
          <Rocket class="h-5 w-5" /> {{ submitting ? "提交中…" : "让 AI 生成!" }}
        </Button>
        <Button variant="ghost" class="w-full" @click="step = 'confirm'"><RotateCcw class="h-4 w-4" /> 返回修改描述</Button>
      </Card>
    </template>

    <!-- ④ 排队/生成中 -->
    <template v-else-if="step === 'waiting'">
      <Card class="space-y-6 p-8 text-center">
        <div class="mx-auto flex h-24 w-24 animate-pulse items-center justify-center rounded-full bg-primary/10">
          <Bot class="h-12 w-12 text-primary" />
        </div>
        <div>
          <div class="text-lg font-semibold">{{ waitingText }}</div>
          <div class="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div class="h-full w-1/3 animate-[slide_1.5s_ease-in-out_infinite] rounded-full bg-primary"></div>
          </div>
          <div class="mt-3 text-sm text-muted-foreground">已等待 {{ waitElapsed }} 秒,一般 1–3 分钟</div>
        </div>
        <div class="rounded-xl bg-muted/60 p-4 text-sm text-muted-foreground">{{ funFact }}</div>
        <p v-if="status?.status === 'failed'" class="text-sm text-destructive">
          {{ status.error }}<br />点击重新生成,或找工作人员帮忙
        </p>
        <Button v-if="status?.status === 'failed'" variant="outline" @click="restart">重新生成</Button>
      </Card>
    </template>

    <!-- ⑤ 预览 + refine + 发布 -->
    <template v-else-if="step === 'preview'">
      <div class="space-y-4">
        <PreviewFrame :task-id="taskId" :version="htmlVersion" />
        <p v-if="submitError" class="text-center text-sm text-destructive">{{ submitError }}</p>
        <Button size="xl" class="w-full" :disabled="publishing" @click="publish">
          <ThumbsUp class="h-5 w-5" /> {{ publishing ? "发布中…" : "满意,发布我的网页!" }}
        </Button>

        <!-- refine -->
        <Card v-if="(status?.refinements ?? 0) < (status?.maxRefine ?? 2)" class="space-y-3 p-4">
          <div class="flex items-center gap-2 text-sm font-medium"><PenLine class="h-4 w-4" /> 想改改?告诉 AI 哪里不满意</div>
          <div class="flex gap-2">
            <input
              v-model="refineText"
              placeholder="比如:换个蓝色主题 / 标题再大一点"
              class="h-11 flex-1 rounded-lg border bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              @keydown.enter="submitRefine"
            />
            <Button :disabled="refining || refineText.trim().length < 2" @click="submitRefine">
              {{ refining ? "…" : "修改" }}
            </Button>
          </div>
          <p class="text-xs text-muted-foreground">
            剩余修改次数:{{ (status?.maxRefine ?? 2) - (status?.refinements ?? 0) }} 次
            <span v-if="refineError" class="text-destructive"> · {{ refineError }}</span>
          </p>
        </Card>
        <div v-else class="text-center text-xs text-muted-foreground">修改次数已用完 ~</div>
        <Button variant="ghost" class="w-full" @click="restart"><RefreshCw class="h-4 w-4" /> 完全重新来一个</Button>
      </div>
    </template>

    <!-- ⑥ 凭证 -->
    <template v-else-if="step === 'certificate' && cert">
      <CertificateCard :code="cert.code" :publish-url="cert.publishUrl" :verify-url="cert.verifyUrl" :domain="cert.domain" :email="cert.email" />
      <Button variant="ghost" class="mt-4 w-full" @click="restart"><Plus class="h-4 w-4" /> 帮朋友也做一个</Button>
    </template>

    <footer class="mt-12 text-center text-xs text-muted-foreground">Words to Website · Activity 3</footer>
  </div>
</template>

<style scoped>
@keyframes slide {
  0% { margin-left: -35%; }
  100% { margin-left: 100%; }
}
</style>
