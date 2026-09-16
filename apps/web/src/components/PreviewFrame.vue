<script setup lang="ts">
import { computed } from "vue";
import { apiUrl } from "@/lib/apiBase";

const props = defineProps<{ taskId: string; version?: number }>();
const src = computed(() =>
  apiUrl(`/api/tasks/${props.taskId}/html?v=${props.version ?? 0}`),
);
</script>

<template>
  <div class="overflow-hidden rounded-xl border bg-white shadow-inner">
    <!-- sandbox：仅允许脚本，禁止同源/表单/弹窗，防生成物触碰活动站 -->
    <iframe
      :src="src"
      sandbox="allow-scripts"
      class="h-[62vh] w-full border-0"
      title="生成的网页预览"
    />
  </div>
</template>
