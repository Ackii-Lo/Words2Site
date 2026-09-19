<script setup lang="ts">
import { Check } from "lucide-vue-next";
import { t } from "@/i18n";

/**
 * 步骤③（仅电脑端）已提交：用户提交后即释放电脑，制作在服务端后台进行。
 * 确认按钮把整台电脑重置回欢迎页，交给下一位——本步显示什么与后台
 * 生成/截图（lib/captureQueue.ts）完全无关。
 */
defineProps<{ email: string }>();
defineEmits<{ confirm: [] }>();
</script>

<template>
  <div class="sent-wrap">
    <span class="sent-circle"
      ><Check class="sent-check" :stroke-width="3"
    /></span>
    <h2 class="sent-title">{{ t("sent.title") }}</h2>
    <p class="sent-sub">{{ t("sent.sub") }}</p>
    <p v-if="email" class="sent-email">{{ email }}</p>
    <button class="btn-ink no-arrow" type="button" @click="$emit('confirm')">
      {{ t("sent.confirm") }}
    </button>
  </div>
</template>

<style scoped>
.sent-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 26px;
}
.sent-circle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 88px;
  height: 88px;
  border: 2px solid #1c1917;
  border-radius: 50%;
  background: #f7d447;
  box-sizing: border-box;
}
.sent-check {
  width: 44px;
  height: 44px;
  color: #1c1917;
}
.sent-title {
  margin-top: 22px;
  font-size: 17px;
  font-weight: 900;
  line-height: 1.3;
  text-align: center;
  color: #1c1917;
}
.sent-sub {
  margin-top: 10px;
  font-size: 12px;
  line-height: 1.7;
  text-align: center;
  color: rgba(28, 25, 23, 0.68);
  white-space: pre-line;
}
.sent-email {
  margin-top: 8px;
  padding: 7px 14px;
  border: 1.5px dashed #1c1917;
  border-radius: 4px;
  background: #fdf4d6;
  font-family: Consolas, Menlo, ui-monospace, monospace;
  font-size: 11px;
  font-weight: 700;
  color: #1c1917;
  word-break: break-all;
}
.btn-ink {
  position: relative;
  width: 100%;
  height: 46px;
  margin-top: 26px;
  border: 0;
  border-radius: 4px;
  background: #1c1917;
  color: #f7d447;
  font-size: 13px;
  font-weight: 800;
  transition: transform 0.12s ease;
}
.btn-ink.no-arrow::after {
  content: none;
}
.btn-ink:active {
  transform: scale(0.985);
}

/* ===== 桌面端 ===== */
@media (min-width: 900px) {
  .sent-wrap {
    padding-top: 52px;
  }
  .sent-circle {
    width: 150px;
    height: 150px;
    border-width: 3px;
  }
  .sent-check {
    width: 74px;
    height: 74px;
  }
  .sent-title {
    margin-top: 26px;
    font-size: 34px;
    letter-spacing: -0.5px;
  }
  .sent-sub {
    margin-top: 14px;
    font-size: 16px;
    line-height: 1.8;
  }
  .sent-email {
    margin-top: 12px;
    padding: 10px 20px;
    font-size: 14px;
  }
  .btn-ink {
    height: 64px;
    margin-top: 34px;
    font-size: 17px;
    letter-spacing: 1px;
  }
}
</style>
