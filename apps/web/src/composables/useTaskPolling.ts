import { ref, onUnmounted } from "vue";
import { api, type TaskStatus } from "./useApi";

/** 2s 轮询任务状态，终态自动停 */
export function useTaskPolling() {
  const status = ref<TaskStatus | null>(null);
  const error = ref<string | null>(null);
  let timer: ReturnType<typeof setTimeout> | null = null;
  let taskId = "";

  async function tick() {
    try {
      status.value = await api<TaskStatus>(`/api/tasks/${taskId}`);
      error.value = null;
      const s = status.value.status;
      if (s === "done" || s === "failed" || s === "published") return; // 终态停（done 仅存量兼容）
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
    }
    timer = setTimeout(tick, 2000);
  }

  function start(id: string) {
    stop();
    taskId = id;
    void tick();
  }

  function stop() {
    if (timer) clearTimeout(timer);
    timer = null;
  }

  onUnmounted(stop);
  return { status, error, start, stop, refresh: tick };
}
