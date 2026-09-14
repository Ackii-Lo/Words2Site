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

type Step = "intro" | "record" | "confirm" | "waiting" | "preview" | "certificate";

const step = ref<Step>("intro");
const transcript = ref("");
const draft = ref("");
const inputMode = ref<"voice" | "typing">("voice");
const submitting = ref(false);
const submitError = ref("");
const taskId = ref("");
const htmlVersion = ref(0);
const cert = ref<{ code: string; publishUrl: string | null; verifyUrl: string } | null>(null);
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
    return;
  }
  submitting.value = true;
  submitError.value = "";
  try {
    const data = await api<{ taskId: string }>("/api/tasks", {
      method: "POST",
      body: JSON.stringify({ text, deviceId: deviceId(), transcript: transcript.value || null }),
    });
    taskId.value = data.taskId;
    step.value = "waiting";
    startPolling(data.taskId);
  } catch (e) {
    submitError.value = e instanceof Error ? e.message : String(e);
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
  "🧱 AI 正在一块块搬砖砌你的网页…",
  "🎨 正在挑选合适的配色方案…",
  "✨ 帮你的网页加上一点魔法…",
  "📱 正在适配你的手机屏幕…",
  "🚀 马上就好,网页马上起飞…",
];
const funFact = computed(() => funFacts[waitElapsed.value % funFacts.length]);
</script>

<template>
  <div class="mx-auto min-h-dvh w-full max-w-lg px-4 pb-16 pt-10">
    <!-- 顶部 -->
    <header class="mb-8 text-center">
      <div class="text-4xl">🗣️→🌐</div>
      <h1 class="mt-2 text-2xl font-bold">一句话,生成你的网页</h1>
      <p v-if="step === 'intro'" class="mt-2 text-sm text-muted-foreground">
        对 AI 说说你想要的网页,几分钟后它就是真的了
      </p>
    </header>

    <!-- ① 首页 -->
    <template v-if="step === 'intro'">
      <Card class="space-y-5 p-6">
        <div class="space-y-3 text-sm text-muted-foreground">
          <div class="flex items-center gap-3"><span class="text-xl">1️⃣</span> 对着麦克风描述你想要的网页</div>
          <div class="flex items-center gap-3"><span class="text-xl">2️⃣</span> AI 现场为你生成网页</div>
          <div class="flex items-center gap-3"><span class="text-xl">3️⃣</span> 发布并获得集章凭证 🎫</div>
        </div>
        <Button size="xl" class="w-full" @click="step = 'record'">开始体验</Button>
      </Card>
    </template>

    <!-- ② 录音 -->
    <template v-else-if="step === 'record'">
      <div class="mb-4 flex justify-center gap-2">
        <Button :variant="inputMode === 'voice' ? 'default' : 'outline'" size="sm" @click="inputMode = 'voice'">🎤 语音</Button>
        <Button :variant="inputMode === 'typing' ? 'default' : 'outline'" size="sm" @click="inputMode = 'typing'">⌨️ 打字</Button>
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
          <h2 class="font-semibold">确认一下你的想法 ✍️</h2>
          <Badge variant="secondary">可编辑</Badge>
        </div>
        <p v-if="transcript" class="text-xs text-muted-foreground">🎤 语音识别结果(可直接修改):</p>
        <Textarea v-model="draft" class="min-h-40 text-base" />
        <p class="text-right text-xs" :class="draft.length > 300 || draft.trim().length < 10 ? 'text-destructive' : 'text-muted-foreground'">
          {{ draft.length }} / 300(至少 10 字)
        </p>
        <p v-if="submitError" class="text-sm text-destructive">{{ submitError }}</p>
        <Button size="xl" class="w-full" :disabled="submitting || draft.trim().length < 10 || draft.length > 300" @click="submitTask">
          {{ submitting ? "提交中…" : "🚀 让 AI 生成!" }}
        </Button>
        <Button variant="ghost" class="w-full" @click="restart">↩️ 重新说</Button>
      </Card>
    </template>

    <!-- ④ 排队/生成中 -->
    <template v-else-if="step === 'waiting'">
      <Card class="space-y-6 p-8 text-center">
        <div class="mx-auto flex h-24 w-24 animate-pulse items-center justify-center rounded-full bg-primary/10 text-5xl">🤖</div>
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
          {{ publishing ? "发布中…" : "😍 满意,发布我的网页!" }}
        </Button>

        <!-- refine -->
        <Card v-if="(status?.refinements ?? 0) < (status?.maxRefine ?? 2)" class="space-y-3 p-4">
          <div class="text-sm font-medium">🤔 想改改?告诉 AI 哪里不满意</div>
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
        <Button variant="ghost" class="w-full" @click="restart">🔄 完全重新来一个</Button>
      </div>
    </template>

    <!-- ⑥ 凭证 -->
    <template v-else-if="step === 'certificate' && cert">
      <CertificateCard :code="cert.code" :publish-url="cert.publishUrl" :verify-url="cert.verifyUrl" />
      <Button variant="ghost" class="mt-4 w-full" @click="restart">帮朋友也做一个 ➕</Button>
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
