<script setup lang="ts">
import { computed } from "vue";
import { apiUrl } from "@/lib/apiBase";

const props = defineProps<{ taskId: string; version?: number }>();
const src = computed(() =>
  apiUrl(`/api/tasks/${props.taskId}/html?v=${props.version ?? 0}`),
);
</script>

<template>
  <div class="preview-card">
    <!-- sandbox：仅允许脚本，禁止同源/表单/弹窗，防生成物触碰活动站 -->
    <iframe
      :src="src"
      sandbox="allow-scripts"
      class="preview-frame"
      title="生成的网页预览"
    />
  </div>
</template>

<style scoped>
.preview-card {
  padding: 14px;
  border: 1px solid #eeede9;
  border-radius: 14px;
  background: #fff;
}
.preview-frame {
  display: block;
  width: 100%;
  height: 292px;
  border: 0;
  border-radius: 8px;
  background: #fafaf7;
}
</style>
