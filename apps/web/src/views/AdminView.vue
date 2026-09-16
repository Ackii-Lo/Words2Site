<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { api } from "@/composables/useApi";
import Card from "@/components/ui/Card.vue";
import Badge from "@/components/ui/Badge.vue";
import Button from "@/components/ui/Button.vue";
import SessionBoard, { type LiveSession } from "@/components/SessionBoard.vue";
import {
  Lock,
  Wrench,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Monitor,
  Trash2,
} from "lucide-vue-next";

interface TaskRow {
  id: string;
  code: string | null;
  prompt: string;
  status: string;
  stage: string | null;
  error: string | null;
  attempts: number;
  refinements: number;
  ip: string | null;
  email: string | null;
  domain: string | null;
  is_public: number;
  removed_at: number | null;
  publish_url: string | null;
  created_at: number;
  finished_at: number | null;
}

const authed = ref(false);
const password = ref("");
const authError = ref("");

const overview = ref<{
  stats: {
    active: number;
    done: number;
    published: number;
    failed: number;
    avg_ms: number | null;
  };
  queue: { pending: number; active: number; slots: number };
} | null>(null);
const taskList = ref<TaskRow[]>([]);
const sessions = ref<{
  slots: number;
  active: number;
  sessions: LiveSession[];
} | null>(null);
const probe = ref<{ ok: boolean; detail: string } | null>(null);
const probing = ref(false);

let timer: ReturnType<typeof setInterval> | null = null;

function authHeader(): Record<string, string> {
  return { Authorization: `Basic ${btoa(`admin:${password.value}`)}` };
}

async function login() {
  authError.value = "";
  try {
    await api("/api/admin/overview", { headers: authHeader() });
    sessionStorage.setItem("w2s-admin-pw", password.value);
    authed.value = true;
    await refresh();
    timer = setInterval(refresh, 3000);
  } catch (e) {
    authError.value = e instanceof Error ? e.message : String(e);
  }
}

async function refresh() {
  try {
    const [ov, tl, ss] = await Promise.all([
      api<typeof overview.value>("/api/admin/overview", {
        headers: authHeader(),
      }),
      api<{ tasks: TaskRow[] }>("/api/admin/tasks", { headers: authHeader() }),
      api<typeof sessions.value>("/api/admin/sessions", {
        headers: authHeader(),
      }),
    ]);
    overview.value = ov;
    taskList.value = tl.tasks;
    sessions.value = ss;
  } catch {
    /* 弱网容忍，下轮再取 */
  }
}

async function retry(id: string) {
  await api(`/api/admin/tasks/${id}/retry`, {
    method: "POST",
    headers: authHeader(),
  }).catch(() => {});
  void refresh();
}
async function skip(id: string) {
  await api(`/api/admin/tasks/${id}/skip`, {
    method: "POST",
    headers: authHeader(),
  }).catch(() => {});
  void refresh();
}
async function kill(sid: string) {
  await api(`/api/admin/sessions/${sid}/kill`, {
    method: "POST",
    headers: authHeader(),
  }).catch(() => {});
  void refresh();
}
async function removeTask(id: string) {
  if (!confirm("下线该网页？将删除网关上的部署，直接链接随即失效。")) return;
  try {
    await api(`/api/admin/tasks/${id}/delete`, {
      method: "POST",
      headers: authHeader(),
    });
  } catch (e) {
    alert(e instanceof Error ? e.message : String(e));
  }
  void refresh();
}
async function runProbe() {
  probing.value = true;
  try {
    probe.value = await api("/api/admin/probe", {
      method: "POST",
      headers: authHeader(),
    });
  } finally {
    probing.value = false;
  }
}

onMounted(() => {
  const saved = sessionStorage.getItem("w2s-admin-pw");
  if (saved) {
    password.value = saved;
    void login();
  }
});
onUnmounted(() => timer && clearInterval(timer));

const statusVariant: Record<
  string,
  "success" | "warning" | "destructive" | "secondary" | "default"
> = {
  published: "success",
  done: "default",
  failed: "destructive",
  generating: "warning",
  validating: "warning",
  queued: "secondary",
};
</script>

<template>
  <div class="mx-auto min-h-dvh w-full max-w-6xl px-4 py-8">
    <!-- 登录 -->
    <div v-if="!authed" class="mx-auto mt-20 max-w-sm">
      <Card class="space-y-4 p-6">
        <h1 class="flex items-center gap-2 text-lg font-bold">
          <Lock class="h-5 w-5" /> 工作人员登录
        </h1>
        <input
          v-model="password"
          type="password"
          placeholder="管理密码（ADMIN_PASSWORD）"
          class="h-11 w-full rounded-lg border bg-card px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          @keydown.enter="login"
        />
        <p v-if="authError" class="text-sm text-destructive">{{ authError }}</p>
        <Button class="w-full" @click="login">登录</Button>
      </Card>
    </div>

    <template v-else>
      <div class="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-2">
          <h1 class="flex items-center gap-2 text-xl font-bold">
            <Wrench class="h-6 w-6" /> Words2Site 管理台
          </h1>
          <a
            href="/screen"
            target="_blank"
            class="text-xs text-primary hover:underline"
            >大屏</a
          >
        </div>
        <div class="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            :disabled="probing"
            @click="runProbe"
          >
            <Activity class="h-4 w-4" />
            {{ probing ? "探活中…" : "codex 探活" }}
          </Button>
          <a href="/screen" target="_blank">
            <Button variant="outline" size="sm"
              ><Monitor class="h-4 w-4" /> 大屏</Button
            >
          </a>
        </div>
      </div>

      <!-- 探活结果 -->
      <Card
        v-if="probe"
        class="mb-6 p-4"
        :class="
          probe.ok
            ? 'border-emerald-300'
            : 'border-destructive bg-destructive/5'
        "
      >
        <div
          :class="probe.ok ? 'text-emerald-600' : 'text-destructive'"
          class="flex items-center gap-2 text-sm"
        >
          <CheckCircle2 v-if="probe.ok" class="h-4 w-4" />
          <AlertTriangle v-else class="h-4 w-4" />
          {{ probe.ok ? "codex 正常" : "codex 异常" }}
          <span class="text-xs opacity-70">{{ probe.detail }}</span>
        </div>
      </Card>

      <!-- 指标 -->
      <div v-if="overview" class="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Card class="p-4 text-center">
          <div class="text-2xl font-bold">{{ overview.queue.pending }}</div>
          <div class="text-xs text-muted-foreground">排队中</div>
        </Card>
        <Card class="p-4 text-center">
          <div class="text-2xl font-bold text-amber-500">
            {{ overview.queue.active }}
          </div>
          <div class="text-xs text-muted-foreground">
            进行中 / {{ overview.queue.slots }} 槽
          </div>
        </Card>
        <Card class="p-4 text-center">
          <div class="text-2xl font-bold">{{ overview.stats.published }}</div>
          <div class="text-xs text-muted-foreground">已发布</div>
        </Card>
        <Card class="p-4 text-center">
          <div class="text-2xl font-bold text-destructive">
            {{ overview.stats.failed }}
          </div>
          <div class="text-xs text-muted-foreground">失败</div>
        </Card>
        <Card class="p-4 text-center">
          <div class="text-2xl font-bold">
            {{
              overview.stats.avg_ms
                ? (overview.stats.avg_ms / 1000).toFixed(0) + "s"
                : "—"
            }}
          </div>
          <div class="text-xs text-muted-foreground">平均耗时</div>
        </Card>
      </div>

      <!-- 会话池 -->
      <Card class="mb-6 p-4">
        <SessionBoard
          v-if="sessions"
          :slots="sessions.slots"
          :active="sessions.active"
          :sessions="sessions.sessions"
          @kill="kill"
        />
      </Card>

      <!-- 任务表 -->
      <Card class="overflow-x-auto p-0">
        <table class="w-full text-sm">
          <thead>
            <tr
              class="border-b bg-muted/50 text-left text-xs text-muted-foreground"
            >
              <th class="px-3 py-2.5">任务</th>
              <th class="px-3 py-2.5">状态</th>
              <th class="px-3 py-2.5">描述</th>
              <th class="px-3 py-2.5">IP</th>
              <th class="px-3 py-2.5">耗时</th>
              <th class="px-3 py-2.5">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="t in taskList"
              :key="t.id"
              class="border-b last:border-0 hover:bg-muted/30"
            >
              <td class="px-3 py-2">
                <div class="font-mono text-xs">{{ t.id }}</div>
                <div v-if="t.code" class="text-xs text-primary">
                  {{ t.code }}
                </div>
              </td>
              <td class="px-3 py-2">
                <Badge :variant="statusVariant[t.status] ?? 'secondary'">{{
                  t.status
                }}</Badge>
                <Badge v-if="t.removed_at" variant="destructive" class="ml-1"
                  >已下线</Badge
                >
                <Badge
                  v-else-if="t.status === 'published' && !t.is_public"
                  variant="secondary"
                  class="ml-1"
                  >不公开</Badge
                >
                <div
                  v-if="t.error"
                  class="mt-1 max-w-48 truncate text-xs text-destructive"
                  :title="t.error"
                >
                  {{ t.error }}
                </div>
              </td>
              <td class="max-w-64 truncate px-3 py-2" :title="t.prompt">
                {{ t.prompt }}
                <span
                  v-if="t.refinements > 0"
                  class="text-xs text-muted-foreground"
                  >(改{{ t.refinements }}次)</span
                >
              </td>
              <td class="px-3 py-2 text-xs text-muted-foreground">
                {{ t.ip }}
                <div
                  v-if="t.email || t.domain"
                  class="mt-0.5 max-w-40 truncate text-[11px]"
                  :title="`${t.email ?? ''} ${t.domain ?? ''}`"
                >
                  {{ t.domain ?? t.email }}
                </div>
              </td>
              <td class="px-3 py-2 text-xs">
                {{
                  t.finished_at
                    ? ((t.finished_at - t.created_at) / 1000).toFixed(0) + "s"
                    : "…"
                }}
              </td>
              <td class="space-x-1 px-3 py-2 whitespace-nowrap">
                <Button
                  v-if="t.status === 'failed'"
                  size="sm"
                  variant="outline"
                  @click="retry(t.id)"
                  >重试</Button
                >
                <a
                  v-if="t.publish_url && !t.removed_at"
                  :href="t.publish_url"
                  target="_blank"
                >
                  <Button size="sm" variant="ghost">链接</Button>
                </a>
                <Button
                  v-if="t.status === 'done'"
                  size="sm"
                  variant="ghost"
                  @click="skip(t.id)"
                  >跳过</Button
                >
                <Button
                  v-if="t.status === 'published' && !t.removed_at"
                  size="sm"
                  variant="destructive"
                  @click="removeTask(t.id)"
                >
                  <Trash2 class="h-3.5 w-3.5" /> 下线
                </Button>
              </td>
            </tr>
          </tbody>
        </table>
      </Card>
    </template>
  </div>
</template>
