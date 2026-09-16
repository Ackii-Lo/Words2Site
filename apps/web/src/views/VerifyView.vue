<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import { api } from "@/composables/useApi";
import Card from "@/components/ui/Card.vue";
import Badge from "@/components/ui/Badge.vue";
import Button from "@/components/ui/Button.vue";
import { Ticket, CircleX, CheckCircle2, Link as LinkIcon } from "lucide-vue-next";

const route = useRoute();
const loading = ref(true);
const error = ref("");
const data = ref<{
  code: string;
  prompt: string;
  publishUrl: string | null;
  domain: string | null;
  status: string;
  createdAt: number;
  finishedAt: number | null;
} | null>(null);

onMounted(async () => {
  try {
    data.value = await api(`/api/verify/${route.params.code}`);
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
});

function fmt(ts: number | null): string {
  return ts ? new Date(ts).toLocaleString("zh-CN") : "—";
}
</script>

<template>
  <div class="mx-auto min-h-dvh w-full max-w-lg px-4 py-10">
    <h1 class="mb-6 flex items-center justify-center gap-2 text-center text-xl font-bold">
      <Ticket class="h-6 w-6 text-primary" /> 集章核验
    </h1>

    <div v-if="loading" class="py-20 text-center text-muted-foreground">核验中…</div>
    <Card v-else-if="error" class="space-y-4 p-8 text-center">
      <CircleX class="mx-auto h-14 w-14 text-destructive" />
      <p class="text-destructive">{{ error }}</p>
      <p class="text-sm text-muted-foreground">凭证无效，请与参与者确认编号，或到管理台查询任务</p>
    </Card>

    <Card v-else-if="data" class="space-y-5 p-6">
      <div class="text-center">
        <div class="text-xs text-muted-foreground">凭证编号</div>
        <div class="font-mono text-3xl font-bold tracking-widest text-primary">{{ data.code }}</div>
      </div>

      <div class="flex items-center justify-center gap-2">
        <Badge v-if="data.status === 'published'" variant="success" class="gap-1">
          <CheckCircle2 class="h-3.5 w-3.5" /> 已发布 · 可集章
        </Badge>
        <Badge v-else-if="data.status === 'removed'" variant="destructive">已下线</Badge>
        <Badge v-else variant="warning">状态异常： {{ data.status }}</Badge>
      </div>

      <div class="space-y-3 rounded-xl bg-muted/60 p-4 text-sm">
        <div>
          <div class="mb-1 text-xs text-muted-foreground">参与者描述</div>
          <div>{{ data.prompt }}</div>
        </div>
        <div class="flex justify-between text-xs text-muted-foreground">
          <span>创建：{{ fmt(data.createdAt) }}</span>
          <span>完成：{{ fmt(data.finishedAt) }}</span>
        </div>
      </div>

      <a v-if="data.publishUrl" :href="data.publishUrl" target="_blank" class="block">
        <Button variant="outline" class="w-full"><LinkIcon class="h-4 w-4" /> 查看已发布的网页</Button>
      </a>
      <p class="text-center text-xs text-muted-foreground">确认无误后，给参与者盖章</p>
    </Card>
  </div>
</template>
