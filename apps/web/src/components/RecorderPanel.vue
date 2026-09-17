<script setup lang="ts">
import { ref } from "vue";
import { useRecorder } from "@/composables/useRecorder";
import { apiUrl } from "@/lib/apiBase";
import Badge from "@/components/ui/Badge.vue";
import { Mic, Square } from "lucide-vue-next";

const emit = defineEmits<{
  transcribed: [payload: { text: string; seconds: number }];
}>();
const uploading = ref(false);
const uploadError = ref("");

async function uploadAudio(blob: Blob) {
  uploading.value = true;
  uploadError.value = "";
  const seconds = rec.elapsed.value;
  try {
    const form = new FormData();
    form.append("audio", blob, "audio.webm");
    const res = await fetch(apiUrl("/api/transcribe"), {
      method: "POST",
      body: form,
    });
    const data = (await res.json().catch(() => ({}))) as {
      text?: string;
      error?: string;
    };
    if (!res.ok || !data.text)
      throw new Error(data.error || `转写失败（${res.status}）`);
    emit("transcribed", { text: data.text, seconds });
  } catch (e) {
    uploadError.value = e instanceof Error ? e.message : String(e);
  } finally {
    uploading.value = false;
  }
}

const rec = useRecorder(uploadAudio);
const recording = rec.state;
</script>

<template>
  <div class="recorder">
    <div class="rec-zone">
      <button
        v-if="recording !== 'recording'"
        class="rec-mic"
        type="button"
        :disabled="recording === 'uploading' || recording === 'requesting'"
        @click="rec.start()"
      >
        <Mic class="rec-mic-icon" />
        <span class="rec-mic-label">
          {{
            recording === "uploading"
              ? "转写中…"
              : recording === "requesting"
                ? "请求麦克风…"
                : "点击说话"
          }}
        </span>
      </button>

      <div v-else class="rec-live">
        <span class="rec-live-circle">
          <span class="rec-live-ping"></span>
          <Mic class="rec-mic-icon" />
          <span class="rec-live-time"
            >录音中 {{ rec.elapsed.value }}s / 90s</span
          >
        </span>
        <button class="btn-primary" type="button" @click="rec.stop()">
          <Square class="h-4 w-4" /> 说完啦，停一下
        </button>
      </div>
    </div>

    <p v-if="rec.message.value" class="rec-warn">
      {{ rec.message.value }}，请打字输入
    </p>
    <p v-if="uploadError" class="rec-warn">{{ uploadError }}，请打字输入</p>

    <div class="rec-hint">
      <Badge variant="secondary" class="mb-2">提示</Badge>
      想想你要什么网页：介绍你的猫？你的社团？你最喜欢的球队？
      说得越具体，生成的网页越精彩。
    </div>
  </div>
</template>

<style scoped>
.recorder {
  margin-top: 24px;
}
.rec-zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 22px 0;
  border: 1px dashed #e7e5e0;
  border-radius: 14px;
  background: #fff;
}
.rec-mic {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 120px;
  height: 120px;
  border: 0;
  border-radius: 50%;
  background: #f7d447;
  color: #1c1917;
  transition: transform 0.12s ease;
}
.rec-mic:active:not(:disabled) {
  transform: scale(0.96);
}
.rec-mic:disabled {
  opacity: 0.55;
}
.rec-mic-icon {
  width: 38px;
  height: 38px;
}
.rec-mic-label {
  font-size: 13px;
  font-weight: 700;
}
.rec-live {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
}
.rec-live-circle {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: #1c1917;
  color: #f7d447;
}
.rec-live-ping {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: rgba(28, 25, 23, 0.12);
  animation: ping 1.6s cubic-bezier(0, 0, 0.2, 1) infinite;
}
.rec-live-time {
  font-size: 11px;
}
@keyframes ping {
  75%,
  100% {
    transform: scale(1.25);
    opacity: 0;
  }
}
.btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 50px;
  padding: 0 22px;
  border: 0;
  border-radius: 12px;
  background: #f7d447;
  color: #1c1917;
  font-size: 15px;
  font-weight: 700;
}
.rec-warn {
  margin-top: 12px;
  font-size: 12px;
  text-align: center;
  color: #78716c;
}
.rec-hint {
  margin-top: 16px;
  padding: 16px;
  border: 1px dashed #e7e5e0;
  border-radius: 12px;
  background: #fafaf7;
  font-size: 12px;
  line-height: 1.7;
  text-align: center;
  color: #78716c;
}
</style>
