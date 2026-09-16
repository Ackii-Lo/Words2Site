<script setup lang="ts">
import Badge from "@/components/ui/Badge.vue";
import Button from "@/components/ui/Button.vue";

export interface LiveSession {
  sessionId: string;
  taskId: string | null;
  pid: number | null;
  state: string;
  workdir: string | null;
  startedAt: number;
}

defineProps<{
  slots: number;
  active: number;
  sessions: LiveSession[];
}>();
const emit = defineEmits<{ kill: [sessionId: string] }>();

function dur(ts: number): string {
  return `${Math.round((Date.now() - ts) / 1000)}s`;
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
    <div
      v-for="s in sessions"
      :key="s.sessionId"
      class="flex items-center justify-between gap-3 rounded-xl border p-3"
    >
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2">
          <Badge :variant="stateVariant[s.state] ?? 'secondary'">{{
            s.state
          }}</Badge>
          <span class="truncate font-mono text-xs text-muted-foreground">
            {{ s.sessionId.slice(0, 24)
            }}<span v-if="s.pid"> · pid {{ s.pid }}</span>
          </span>
        </div>
        <div class="mt-1 text-xs text-muted-foreground">
          task: {{ s.taskId ?? "—" }} · 已运行 {{ dur(s.startedAt) }}
        </div>
      </div>
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
</template>
