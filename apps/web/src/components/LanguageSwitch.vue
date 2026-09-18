<script setup lang="ts">
import { Languages } from "lucide-vue-next";
import { locale, setLocale, t, type Locale } from "@/i18n";

/**
 * 语言下拉（EN / 中文）：绑定 i18n 单例 locale，全站共享同一状态。
 * variant 决定配色：screen＝大屏暗底黄描边；card＝白卡黑描边（/start、核验页）。
 */
withDefaults(defineProps<{ variant?: "screen" | "card" }>(), {
  variant: "card",
});

function on_change(e: Event) {
  setLocale((e.target as HTMLSelectElement).value as Locale);
}
</script>

<template>
  <label class="lang" :class="`lang-${variant}`">
    <Languages class="lang-icon" :size="13" />
    <select
      class="lang-select"
      :value="locale"
      :aria-label="t('lang.switch')"
      @change="on_change"
    >
      <option value="en">EN</option>
      <option value="zh">中文</option>
    </select>
  </label>
</template>

<style scoped>
.lang {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px 3px 7px;
  border-radius: 4px;
  cursor: pointer;
  user-select: none;
}
.lang-icon {
  flex: 0 0 auto;
}
.lang-select {
  border: 0;
  background: transparent;
  font-size: 11px;
  font-weight: 700;
  color: inherit;
  cursor: pointer;
  outline: none;
}
.lang-select option {
  color: #1c1917; /* 弹出列表在浅色系统面板里渲染，锁深色字 */
}

/* 大屏：暗底半透明 + 黄描边（叠在 fixed 大屏右上角） */
.lang-screen {
  background: rgba(28, 25, 23, 0.82);
  border: 1px solid rgba(247, 212, 71, 0.55);
  color: #faf7e8;
}
.lang-screen .lang-icon {
  color: #f7d447;
}

/* 白卡场景（/start、核验页）：白底黑描边，呼应 CPU 黄黑风 */
.lang-card {
  background: #fffdf9;
  border: 2px solid #1c1917;
  color: #1c1917;
}
.lang-card .lang-icon {
  color: #1c1917;
}
</style>
