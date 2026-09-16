<script setup lang="ts">
import { ref } from "vue";
import { useRecorder } from "@/composables/useRecorder";
import { apiUrl } from "@/lib/apiBase";
import Button from "@/components/ui/Button.vue";
import Badge from "@/components/ui/Badge.vue";
import { Mic, Square } from "lucide-vue-next";

const emit = defineEmits<{ transcribed: [text: string] }>();
const uploading = ref(false);
const uploadError = ref("");

async function uploadAudio(blob: Blob) {
  uploading.value = true;
  uploadError.value = "";
  try {
    const form = new FormData();
    form.append("audio", blob, "audio.webm");
    const res = await fetch(apiUrl("/api/transcribe"), { method: "POST", body: form });
    const data = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
    if (!res.ok || !data.text) throw new Error(data.error || `转写失败（${res.status}）`);
    emit("transcribed", data.text);
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
  <div class="space-y-5">
    <div class="flex flex-col items-center gap-4 py-6">
      <!-- 录音按钮 -->
      <button
        v-if="recording !== 'recording'"
        :disabled="recording === 'uploading' || recording === 'requesting'"
        class="flex h-32 w-32 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition active:scale-95 disabled:opacity-60"
        @click="rec.start()"
      >
        <div class="text-center">
          <Mic class="mx-auto h-12 w-12" />
          <div class="mt-1 text-sm font-medium">
            {{ recording === "uploading" ? "转写中…" : recording === "requesting" ? "请求麦克风…" : "点击说话" }}
          </div>
        </div>
      </button>

      <!-- 录音中 -->
      <div v-else class="flex flex-col items-center gap-4">
        <div class="relative flex h-32 w-32 items-center justify-center rounded-full bg-destructive text-white shadow-lg">
          <span class="absolute inset-0 animate-ping rounded-full bg-destructive/30"></span>
          <div class="text-center">
            <Mic class="mx-auto h-12 w-12" />
            <div class="mt-1 text-sm">录音中 {{ rec.elapsed.value }}s / 90s</div>
          </div>
        </div>
        <Button variant="destructive" size="xl" @click="rec.stop()">
          <Square class="h-5 w-5" /> 说完啦，停一下
        </Button>
      </div>
    </div>

    <p v-if="rec.message.value" class="text-center text-sm text-amber-600">{{ rec.message.value }}，请打字输入</p>
    <p v-if="uploadError" class="text-center text-sm text-destructive">{{ uploadError }}，请打字输入</p>

    <div class="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
      <Badge variant="secondary" class="mb-2">提示</Badge>
      想想你要什么网页：介绍你的猫？你的社团？你最喜欢的球队？
      说得越具体，生成的网页越精彩。
    </div>
  </div>
</template>
