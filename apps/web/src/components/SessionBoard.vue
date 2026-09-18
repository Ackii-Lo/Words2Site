<script setup lang="ts">
import { onUnmounted, ref } from "vue";
import Badge from "@/components/ui/Badge.vue";
import Button from "@/components/ui/Button.vue";
import { AlertTriangle, ScrollText } from "lucide-vue-next";

export interface LiveSession {
  sessionId: string;
  taskId: string | null;
  pid: number | null;
  state: string;
  workdir: string | null;
  startedAt: number;
  lastOutputAt: number | null;
  tokensUsed: number | null;
  /** 派生字段：距上次输出的毫秒数；活跃且超 90s 为卡住 */
  idleMs?: number;
  stuck?: boolean;
}

export interface SessionLogTail {
  totalBytes: number;
  lastOutputAt: number | null;
  tail: string;
}

const props = defineProps<{
  slots: number;
  active: number;
  sessions: LiveSession[];
  /** 日志拉取器（由 AdminView 注入，带管理凭证） */
  fetchLog: (taskId: string) => Promise<SessionLogTail>;
}>();
const emit = defineEmits<{ kill: [sessionId: string] }>();

function dur(ts: number): string {
  return `${Math.round((Date.now() - ts) / 1000)}s`;
}
function fmtTokens(n: number | null | undefined): string {
  return typeof n === "number" ? n.toLocaleString() : "—";
}
const stateVariant: Record<
  string,
  "success" | "warning" | "destructive" | "secondary"
> = {
  generating: "warning",
  spawning: "warning",
  done: "success",
  failed: "destructive",
  killed: "destructive",
};

/* ---------- 行内日志：展开即 3s 轮询尾部 ---------- */
const openLogTask = ref<string | null>(null);
const logText = ref("");
const logBytes = ref(0);
let logTimer: ReturnType<typeof setInterval> | null = null;

async function pullLog(taskId: string) {
  try {
    const d = await props.fetchLog(taskId);
    logText.value = d.tail;
    logBytes.value = d.totalBytes;
  } catch {
    /* 弱网容忍，下轮再取 */
  }
}

async function toggleLog(taskId: string | null) {
  if (!taskId) return;
  if (openLogTask.value === taskId) {
    closeLog();
    return;
  }
  closeLog();
  openLogTask.value = taskId;
  logText.value = "";
  logBytes.value = 0;
  await pullLog(taskId);
  logTimer = setInterval(() => {
    if (openLogTask.value) void pullLog(openLogTask.value);
  }, 3000);
}

function closeLog() {
  openLogTask.value = null;
  logText.value = "";
  logBytes.value = 0;
  if (logTimer) clearInterval(logTimer);
  logTimer = null;
}

onUnmounted(closeLog);
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center gap-2 text-sm">
      <Badge variant="secondary">会话池 {{ active }}/{{ slots }}</Badge>
      <span class="text-muted-foreground">活跃 codex 进程实时状态</span>
    </div>
    <div
      v-if="sessions.length === 0"
      class="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground"
    >
      暂无会话记录
    </div>
    <div v-for="s in sessions" :key="s.sessionId" class="rounded-xl border p-3">
      <div class="flex items-center justify-between gap-3">
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <Badge :variant="stateVariant[s.state] ?? 'secondary'">{{
              s.state
            }}</Badge>
            <Badge v-if="s.stuck" variant="destructive" class="gap-1">
              <AlertTriangle class="h-3 w-3" /> 无输出
              {{ Math.round((s.idleMs ?? 0) / 1000) }}s
            </Badge>
            <span class="truncate font-mono text-xs text-muted-foreground">
              {{ s.sessionId.slice(0, 24)
              }}<span v-if="s.pid"> · pid {{ s.pid }}</span>
            </span>
          </div>
          <div class="mt-1 text-xs text-muted-foreground">
            task: {{ s.taskId ?? "—" }} · 已运行 {{ dur(s.startedAt) }} · 无输出
            {{ Math.round((s.idleMs ?? Date.now() - s.startedAt) / 1000) }}s ·
            tokens {{ fmtTokens(s.tokensUsed) }}
          </div>
        </div>
        <div class="flex flex-shrink-0 space-x-1">
          <Button
            v-if="s.taskId"
            variant="outline"
            size="sm"
            @click="toggleLog(s.taskId)"
          >
            <ScrollText class="h-3.5 w-3.5" />
            {{ openLogTask === s.taskId ? "收起" : "日志" }}
          </Button>
          <Button
            v-if="s.state === 'generating' || s.state === 'spawning'"
            variant="destructive"
            size="sm"
            @click="emit('kill', s.sessionId)"
          >
            kill
          </Button>
        </div>
      </div>
      <div v-if="openLogTask === s.taskId" class="mt-2">
        <div class="mb-1 text-[11px] text-muted-foreground">
          codex stdout 尾部 · 共 {{ (logBytes / 1024).toFixed(1) }}KB · 3s
          自动刷新
        </div>
        <pre
          class="max-h-64 overflow-auto rounded-lg bg-muted/60 p-2 font-mono text-[11px] leading-relaxed whitespace-pre-wrap"
          >{{ logText || "（暂无输出）" }}</pre>
      </div>
    </div>
  </div>
</template>
