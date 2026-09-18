<script setup lang="ts">
/**
 * 步骤① 欢迎：主张 + 三行 howto + 开始按钮。
 * 纯展示，点击即向父级抛 next 进入表单步。
 */
defineEmits<{ next: [] }>();

const HOWTO: [string, string][] = [
  ["1", "填写邮箱、网址和网页描述"],
  ["2", "AI 现场为你生成网页"],
  ["3", "自动发布，网址发送到你的邮箱"],
];
</script>

<template>
  <h2 class="hero-h">一句话，生成你的网页</h2>
  <p class="hero-sub2">填好信息交给 AI<br />几分钟后网址就会发到你的邮箱</p>

  <div class="howto">
    <div v-for="[num, txt] in HOWTO" :key="num" class="howto-row">
      <span class="howto-num">{{ num }}</span>
      <span class="howto-txt">{{ txt }}</span>
    </div>
  </div>

  <button class="btn-ink" type="button" @click="$emit('next')">开始体验</button>
</template>

<style scoped>
.hero-h {
  font-size: 20px;
  font-weight: 900;
  color: #1c1917;
}
.hero-sub2 {
  margin-top: 8px;
  font-size: 11.5px;
  line-height: 16px;
  color: rgba(28, 25, 23, 0.68);
}
.howto {
  margin-top: 18px;
}
.howto-row {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 44px;
  margin-bottom: 8px;
  padding: 0 12px;
  border: 2px solid #1c1917;
  border-radius: 4px;
  background: #fdf4d6;
}
.howto-row:last-child {
  margin-bottom: 0;
}
.howto-num {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 3px;
  background: #1c1917;
  font-size: 12px;
  font-weight: 900;
  color: #f7d447;
  flex: 0 0 auto;
}
.howto-txt {
  font-size: 11.5px;
  font-weight: 700;
  color: #1c1917;
}

.btn-ink {
  position: relative;
  width: 100%;
  height: 46px;
  margin-top: 22px;
  border: 0;
  border-radius: 4px;
  background: #1c1917;
  color: #f7d447;
  font-size: 13px;
  font-weight: 800;
  transition: transform 0.12s ease;
}
.btn-ink::after {
  content: "→";
  position: absolute;
  right: 16px;
  font-size: 15px;
  font-weight: 700;
}
.btn-ink:active:not(:disabled) {
  transform: scale(0.985);
}
.btn-ink:disabled {
  opacity: 0.45;
}

/* ===== 桌面端（与 HomeView 方案二布局配套） ===== */
@media (min-width: 900px) {
  .hero-h {
    font-size: 50px;
    line-height: 1.2;
    letter-spacing: -0.5px;
  }
  .hero-sub2 {
    margin-top: 16px;
    font-size: 16.5px;
    line-height: 1.7;
  }
  .howto {
    display: flex;
    gap: 18px;
    margin-top: 32px;
  }
  .howto-row {
    flex: 1;
    flex-direction: column;
    align-items: flex-start;
    gap: 14px;
    height: auto;
    margin-bottom: 0;
    padding: 22px 18px 24px;
  }
  .howto-num {
    width: 36px;
    height: 36px;
    font-size: 17px;
    border-radius: 4px;
  }
  .howto-txt {
    font-size: 15.5px;
    font-weight: 700;
    line-height: 1.5;
  }
  .btn-ink {
    height: 64px;
    margin-top: 32px;
    font-size: 17px;
    letter-spacing: 1px;
  }
  .btn-ink::after {
    right: 26px;
    font-size: 18px;
  }
}
</style>
