import { ref, onUnmounted } from "vue";

export type RecorderState = "idle" | "requesting" | "recording" | "uploading" | "denied" | "error";

const MAX_MS = 90_000;

/** 浏览器录音:按住/点击开关,自动 90s 封顶,产出上传用的 Blob */
export function useRecorder(onDone: (audio: Blob) => void) {
  const state = ref<RecorderState>("idle");
  const elapsed = ref(0);
  const message = ref("");
  let mediaRecorder: MediaRecorder | null = null;
  let chunks: Blob[] = [];
  let timer: ReturnType<typeof setInterval> | null = null;

  async function start() {
    if (state.value === "recording" || state.value === "uploading") return;
    message.value = "";
    state.value = "requesting";
    if (!navigator.mediaDevices?.getUserMedia) {
      state.value = "denied";
      message.value = "当前浏览器不支持录音,请打字输入";
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : undefined,
      });
      chunks = [];
      mediaRecorder.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: mediaRecorder?.mimeType || "audio/webm" });
        if (blob.size > 0) onDone(blob);
      };
      mediaRecorder.start(1000);
      state.value = "recording";
      elapsed.value = 0;
      timer = setInterval(() => {
        elapsed.value += 1;
        if (elapsed.value >= MAX_MS / 1000) stop();
      }, 1000);
    } catch (err) {
      state.value = "denied";
      message.value =
        err instanceof Error && err.name === "NotAllowedError"
          ? "麦克风权限被拒绝,请打字输入(或在浏览器设置中允许麦克风)"
          : "无法访问麦克风,请打字输入";
    }
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
    if (mediaRecorder?.state === "recording") mediaRecorder.stop();
    if (state.value === "recording") state.value = "idle";
  }

  onUnmounted(stop);

  return { state, elapsed, message, start, stop };
}
