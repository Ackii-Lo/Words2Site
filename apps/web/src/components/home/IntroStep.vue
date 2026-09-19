<script setup lang="ts">
import { ref } from "vue";
import { t } from "@/i18n";

/**
 * 步骤① 欢迎：主张 + 三行 howto + 开始按钮。
 * 点开始先弹「你会得到什么」伪弹窗（单 HTML 页面的能力边界，
 * 用户视角措辞），确认后才进入表单步。
 */
const emit = defineEmits<{ next: [] }>();
const notice = ref(false);

const CAN = () => [t("intro.noticeCan1"), t("intro.noticeCan2")];
const CANT = () => [
  t("intro.noticeCant1"),
  t("intro.noticeCant2"),
  t("intro.noticeCant3"),
];

const HOWTO = () =>
  [
    ["1", t("intro.how1")],
    ["2", t("intro.how2")],
    ["3", t("intro.how3")],
  ] as [string, string][];
</script>

<template>
  <h2 class="hero-h">{{ t("intro.title") }}</h2>
  <p class="hero-sub2">{{ t("intro.sub") }}</p>

  <div class="howto">
    <div v-for="[num, txt] in HOWTO()" :key="num" class="howto-row">
      <span class="howto-num">{{ num }}</span>
      <span class="howto-txt">{{ txt }}</span>
    </div>
  </div>

  <button class="btn-ink" type="button" @click="notice = true">
    {{ t("intro.start") }}
  </button>

  <!-- 伪弹窗：盖在卡身内容之上（非真 <dialog>，样式贴系统弹窗） -->
  <Teleport to="body">
    <div v-if="notice" class="veil">
      <div class="notice" role="dialog" aria-modal="true">
        <div class="notice-bar">{{ t("intro.noticeBar") }}</div>
        <div class="notice-body">
          <h3 class="notice-title">{{ t("intro.noticeTitle") }}</h3>
          <p class="notice-lead">{{ t("intro.noticeLead") }}</p>
          <div class="notice-cols">
            <div class="notice-col can">
              <h4 class="notice-col-h">{{ t("intro.noticeCanTitle") }}</h4>
              <ul class="notice-list">
                <li v-for="item in CAN()" :key="item">{{ item }}</li>
              </ul>
            </div>
            <div class="notice-col cant">
              <h4 class="notice-col-h">{{ t("intro.noticeCantTitle") }}</h4>
              <ul class="notice-list">
                <li v-for="item in CANT()" :key="item">{{ item }}</li>
              </ul>
            </div>
          </div>
          <button class="btn-ink no-arrow" type="button" @click="emit('next')">
            {{ t("intro.noticeOk") }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
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
  white-space: pre-line; /* 双语文案用 \n 分行 */
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
.btn-ink.no-arrow::after {
  content: none;
}

/* ===== 伪弹窗（Teleport 到 body，非 scoped 作用域内层） ===== */
.veil {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(28, 25, 23, 0.5);
}
.notice {
  width: min(520px, 100%);
  border: 3px solid #1c1917;
  border-radius: 6px;
  background: #fffdf9;
  box-shadow: 8px 8px 0 rgba(28, 25, 23, 0.85);
  overflow: hidden;
}
.notice-bar {
  padding: 10px 18px;
  background: #1c1917;
  font-family: Consolas, Menlo, ui-monospace, monospace;
  font-size: 10px;
  letter-spacing: 3px;
  color: #f7d447;
}
.notice-body {
  padding: 26px 24px 24px;
}
.notice-title {
  margin: 0;
  font-size: 18px;
  font-weight: 900;
  color: #1c1917;
}
.notice-lead {
  margin: 12px 0 4px;
  font-size: 12.5px;
  line-height: 1.8;
  color: rgba(28, 25, 23, 0.78);
}
/* 能做到 / 不能做到：两栏清单（窄屏自动堆叠） */
.notice-cols {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin: 12px 0 4px;
}
.notice-col {
  flex: 1 1 170px;
  padding: 10px 12px 11px;
  border: 2px solid #1c1917;
  border-radius: 4px;
}
.notice-col.can {
  background: #fdf4d6;
}
.notice-col.cant {
  background: #fffdf9;
  border-style: dashed;
}
.notice-col-h {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 6px;
  font-size: 11.5px;
  font-weight: 900;
  letter-spacing: 0.5px;
  color: #1c1917;
}
.notice-col-h::before {
  content: "";
  width: 9px;
  height: 9px;
  border: 1.5px solid #1c1917;
  border-radius: 2px;
}
.notice-col.can .notice-col-h::before {
  background: #f7d447;
}
.notice-list {
  margin: 0;
  padding: 0;
  list-style: none;
}
.notice-list li {
  position: relative;
  padding-left: 16px;
  font-size: 11.5px;
  line-height: 1.75;
  color: rgba(28, 25, 23, 0.82);
}
.notice-list li::before {
  position: absolute;
  left: 0;
  font-size: 11px;
  font-weight: 900;
}
.notice-col.can .notice-list li::before {
  content: "+";
}
.notice-col.cant .notice-list li::before {
  content: "−";
}
.notice-body .btn-ink {
  width: 100%;
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

  /* 弹窗桌面字号 */
  .notice {
    width: min(660px, 100%);
  }
  .notice-title {
    font-size: 26px;
  }
  .notice-lead {
    font-size: 15.5px;
    line-height: 1.9;
  }
  .notice-cols {
    gap: 14px;
    margin: 16px 0 6px;
  }
  .notice-col {
    flex: 1 1 240px;
    padding: 14px 16px 15px;
  }
  .notice-col-h {
    font-size: 13.5px;
    margin-bottom: 8px;
  }
  .notice-list li {
    font-size: 14px;
    line-height: 1.8;
  }
  .notice-body {
    padding: 34px 32px 30px;
  }
}
</style>
