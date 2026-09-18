<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import { Check, CircleX, LoaderCircle } from "lucide-vue-next";
import { api } from "@/composables/useApi";
import { t } from "@/i18n";

/**
 * 步骤② 填写信息：描述 + 邮箱前缀 + 网址 + 网页语言 + 是否公开，一次提交。
 * 输入状态为本组件局部（切步即卸载、自动清空）；提交与错误展示由父级管。
 */
const props = defineProps<{
  submitting: boolean;
  error: string;
}>();
const emit = defineEmits<{
  submit: [
    payload: {
      text: string;
      email: string;
      domainLabel: string;
      isPublic: boolean;
      pageLang: "zh" | "en";
    },
  ];
}>();

const draft = ref("");
const emailPrefix = ref(""); // 只填前缀，域名固定 @nottingham.edu.cn
const domainLabel = ref("");
const isPublic = ref(true);
const pageLang = ref<"zh" | "en">("zh"); // 生成页面的文案语言
const domainSuffix = ".unnc.space"; // 与服务端 DEPLOY_DOMAIN_TEMPLATE 对应
const EMAIL_SUFFIX = "@nottingham.edu.cn";

const emailValid = computed(() =>
  /^[A-Za-z0-9][A-Za-z0-9._-]{1,30}$/.test(emailPrefix.value.trim()),
);
const domainValid = computed(() =>
  /^[a-z0-9][a-z0-9-]{2,30}$/.test(domainLabel.value.trim()),
);

/* ---------- 网址占用即时校验：输入停顿 400ms 即查（非破坏性，提交仍以原子预约为准） ---------- */
const domainStatus = ref<"idle" | "checking" | "free" | "taken">("idle");
let checkTimer: ReturnType<typeof setTimeout> | null = null;

watch([domainLabel, domainValid], ([, valid]) => {
  if (checkTimer) clearTimeout(checkTimer);
  if (!valid) {
    domainStatus.value = "idle";
    return;
  }
  domainStatus.value = "checking";
  checkTimer = setTimeout(async () => {
    try {
      const r = await api<{ valid: boolean; available: boolean }>(
        `/api/tasks/domain-check?label=${encodeURIComponent(domainLabel.value.trim())}`,
      );
      domainStatus.value = r.available ? "free" : "taken";
    } catch {
      domainStatus.value = "idle"; // 弱网容忍：交给提交时的原子校验兜底
    }
  }, 400);
});
onUnmounted(() => checkTimer && clearTimeout(checkTimer));

const canSubmit = computed(
  () =>
    !props.submitting &&
    draft.value.trim().length >= 10 &&
    draft.value.length <= 300 &&
    emailValid.value &&
    domainValid.value &&
    domainStatus.value === "free",
);

function submit() {
  if (!canSubmit.value) return;
  emit("submit", {
    text: draft.value.trim(),
    email: emailPrefix.value.trim().toLowerCase() + EMAIL_SUFFIX,
    domainLabel: domainLabel.value.trim(),
    isPublic: isPublic.value,
    pageLang: pageLang.value,
  });
}
</script>

<template>
  <!-- 描述：全宽（字数计数内嵌右下角） -->
  <div class="fgroup">
    <div class="flabel">{{ t("form.descLabel") }}</div>
    <div class="edit-wrap">
      <textarea
        v-model="draft"
        class="edit-area"
        :placeholder="t('form.descPlaceholder')"
      ></textarea>
      <span class="edit-count" :class="{ over: draft.length > 300 }"
        >{{ draft.length }} / 300</span
      >
    </div>
  </div>

  <!-- 邮箱 / 网址：两列对称（label + 输入框 + 提示行） -->
  <div class="fgroups">
    <div class="fgroup">
      <div class="flabel">{{ t("form.emailLabel") }}</div>
      <div class="email-group">
        <input
          v-model="emailPrefix"
          class="email-input"
          type="text"
          autocapitalize="off"
          autocorrect="off"
          spellcheck="false"
          :placeholder="t('form.emailPh')"
        />
        <span class="email-addon">{{ EMAIL_SUFFIX }}</span>
      </div>
    </div>
    <div class="fgroup">
      <div class="flabel">{{ t("form.domainLabel") }}</div>
      <div class="email-group">
        <input
          v-model="domainLabel"
          class="email-input"
          type="text"
          autocapitalize="off"
          autocorrect="off"
          spellcheck="false"
          placeholder="my-cat"
        />
        <span class="email-addon">{{ domainSuffix }}</span>
      </div>
      <p
        v-if="domainStatus !== 'idle'"
        class="domain-status"
        :class="'is-' + domainStatus"
      >
        <LoaderCircle
          v-if="domainStatus === 'checking'"
          class="ds-icon spin"
          :size="12"
        />
        <Check v-else-if="domainStatus === 'free'" class="ds-icon" :size="12" />
        <CircleX v-else class="ds-icon" :size="12" />
        {{
          domainStatus === "checking"
            ? t("form.domainChecking")
            : domainStatus === "free"
              ? t("form.domainFree")
              : t("form.domainTaken")
        }}
      </p>
    </div>
  </div>

  <!-- 网页语言 / 大屏展示：两列对称（分段按钮 ↔ 黑底开关同高） -->
  <div class="fgroups">
    <div class="fgroup">
      <div class="flabel">{{ t("form.pageLangLabel") }}</div>
      <div class="seg">
        <button
          class="seg-btn"
          :class="{ 'seg-on': pageLang === 'zh' }"
          type="button"
          @click="pageLang = 'zh'"
        >
          简体中文
        </button>
        <button
          class="seg-btn"
          :class="{ 'seg-on': pageLang === 'en' }"
          type="button"
          @click="pageLang = 'en'"
        >
          English
        </button>
      </div>
    </div>
    <div class="fgroup">
      <div class="flabel">{{ t("form.publicLabel") }}</div>
      <label class="pub-toggle" :class="{ 'pub-on': isPublic }">
        <input v-model="isPublic" class="cb-native" type="checkbox" />
        <span class="pub-box">
          <Check v-if="isPublic" class="pub-check" :stroke-width="3" />
        </span>
        <span class="pub-title">{{
          isPublic ? t("form.publicOn") : t("form.publicOff")
        }}</span>
      </label>
      <p class="hint dim">{{ t("form.publicDesc") }}</p>
    </div>
  </div>

  <p v-if="error" class="err-text">{{ error }}</p>
  <button class="btn-ink" type="button" :disabled="!canSubmit" @click="submit">
    {{ submitting ? t("form.submitting") : t("form.submit") }}
  </button>
</template>

<style scoped>
.flabel {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 20px;
  font-size: 11px;
  font-weight: 700;
  color: #1c1917;
}
.flabel::before {
  content: "";
  width: 10px;
  height: 10px;
  border: 2px solid #1c1917;
  background: #f7d447;
  box-sizing: border-box;
  flex: 0 0 auto;
}
.fgroup:first-child > .flabel:first-child {
  margin-top: 0;
}
/* 描述框：计数器内嵌右下角 */
.edit-wrap {
  position: relative;
  margin-top: 7px;
}
.edit-area {
  display: block;
  width: 100%;
  min-height: 76px;
  padding: 10px 12px 22px;
  border: 2px solid #1c1917;
  border-radius: 4px;
  background: #ffffff;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.6;
  color: #1c1917;
  outline: none;
  resize: none;
  box-sizing: border-box;
}
.edit-area::placeholder {
  font-weight: 400;
  color: rgba(28, 25, 23, 0.4);
}
.edit-area:focus {
  box-shadow: 3px 3px 0 #1c1917;
}
.edit-count {
  position: absolute;
  right: 7px;
  bottom: 6px;
  padding: 0 4px;
  border-radius: 3px;
  background: rgba(255, 253, 249, 0.88); /* 垫底，长文滚动到此处仍可读 */
  font-family: Consolas, Menlo, ui-monospace, monospace;
  font-size: 9.5px;
  color: rgba(28, 25, 23, 0.5);
  pointer-events: none;
}
.edit-count.over {
  color: #b42318;
}
.field-input {
  width: 100%;
  height: 46px;
  margin-top: 7px;
  padding: 0 14px;
  border: 2px solid #1c1917;
  border-radius: 4px;
  background: #ffffff;
  font-size: 13px;
  color: #1c1917;
  outline: none;
  box-sizing: border-box;
}
.field-input::placeholder {
  color: rgba(28, 25, 23, 0.35);
}
.field-input:focus {
  box-shadow: 3px 3px 0 #1c1917;
}
/* 邮箱分段输入组：左段可输入 + 右段固定后缀（浅黄底=不可编辑） */
.email-group {
  display: flex;
  align-items: stretch;
  height: 46px;
  margin-top: 7px;
  border: 2px solid #1c1917;
  border-radius: 4px;
  background: #ffffff;
  box-sizing: border-box;
  overflow: hidden;
}
.email-group:focus-within {
  box-shadow: 3px 3px 0 #1c1917;
}
.email-input {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: none;
  padding: 0 12px;
  background: transparent;
  font-size: 13px;
  font-weight: 700;
  color: #1c1917;
}
.email-input::placeholder {
  font-weight: 400;
  color: rgba(28, 25, 23, 0.35);
}
.email-addon {
  display: flex;
  align-items: center;
  padding: 0 10px;
  border-left: 2px solid #1c1917;
  background: #fdf4d6;
  font-family: Consolas, Menlo, ui-monospace, monospace;
  font-size: 10px;
  font-weight: 700;
  color: rgba(28, 25, 23, 0.75);
  flex: 0 0 auto;
  user-select: none;
}
/* 提示行（dim：表单区说明小字） */
.hint {
  margin-top: 8px;
  font-family: Consolas, Menlo, ui-monospace, monospace;
  font-size: 10.5px;
  color: rgba(28, 25, 23, 0.72);
  word-break: break-all;
}
.hint.dim {
  color: rgba(28, 25, 23, 0.5);
}

/* 占用校验状态行：转圈／可用绿／占用红 */
.domain-status {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 6px;
  font-size: 10.5px;
  font-weight: 700;
}
.ds-icon {
  flex: 0 0 auto;
}
.spin {
  animation: ds-spin 0.9s linear infinite;
}
@keyframes ds-spin {
  to {
    transform: rotate(360deg);
  }
}
.is-free {
  color: #15803d;
}
.is-taken {
  color: #b42318;
}
.is-checking {
  color: rgba(28, 25, 23, 0.6);
}

/* 网页语言分段选择 */
.seg {
  display: flex;
  height: 40px;
  margin-top: 7px;
  padding: 3px;
  border: 2px solid #1c1917;
  border-radius: 4px;
  background: #f1efe8;
  box-sizing: border-box;
}
.seg-btn {
  flex: 1;
  border: 0;
  border-radius: 3px;
  background: none;
  font-size: 11.5px;
  font-weight: 800;
  color: rgba(28, 25, 23, 0.6);
}
.seg-on {
  background: #1c1917;
  color: #f7d447;
}

/* 大屏展示开关：黑底单行，与分段选择同高对齐 */
.pub-toggle {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 40px;
  margin-top: 7px;
  padding: 0 12px;
  border-radius: 4px;
  background: rgba(28, 25, 23, 0.86);
  cursor: pointer;
  user-select: none;
}
.pub-toggle.pub-on {
  background: #1c1917;
}
.cb-native {
  display: none;
}
.pub-box {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border: 1.5px solid rgba(250, 247, 232, 0.5);
  border-radius: 4px;
  background: rgba(250, 247, 232, 0.08);
  flex: 0 0 auto;
}
.pub-on .pub-box {
  border-color: #f7d447;
  background: #f7d447;
}
.pub-check {
  width: 12px;
  height: 12px;
  color: #1c1917;
}
.pub-title {
  font-size: 11.5px;
  font-weight: 800;
  color: #faf7e8;
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

.err-text {
  margin-top: 10px;
  font-size: 11px;
  line-height: 1.6;
  color: #b42318;
}

/* ===== 桌面端：两列 ===== */
@media (min-width: 900px) {
  .fgroups {
    display: flex;
    gap: 32px;
    margin-top: 10px;
    margin-bottom: 10px;
  }
  .fgroup {
    flex: 1;
    min-width: 0;
  }
  .fgroup > .flabel:first-child {
    margin-top: 0;
  }
  .flabel {
    gap: 9px;
    margin-top: 0;
    font-size: 14px;
    letter-spacing: 0.3px;
  }
  .flabel::before {
    width: 10px;
    height: 10px;
  }
  .edit-wrap {
    margin-top: 10px;
  }
  .edit-area {
    min-height: 96px;
    padding: 14px 16px 28px;
    font-size: 17px;
  }
  .edit-count {
    right: 10px;
    bottom: 8px;
    font-size: 12px;
    color: #78716c;
  }
  .field-input {
    height: 64px;
    margin-top: 10px;
    padding: 0 16px;
    font-size: 16px;
    font-weight: 700;
  }
  .email-group {
    height: 64px;
    margin-top: 10px;
  }
  .email-input {
    padding: 0 16px;
    font-size: 16px;
  }
  .email-addon {
    padding: 0 14px;
    font-size: 12.5px;
  }
  .hint {
    margin-top: 10px;
    font-size: 13px;
  }
  .domain-status {
    margin-top: 8px;
    font-size: 13px;
  }
  .ds-icon {
    width: 14px;
    height: 14px;
  }
  .seg {
    height: 56px;
    margin-top: 10px;
  }
  .seg-btn {
    font-size: 15px;
  }
  .pub-toggle {
    height: 56px;
    margin-top: 10px;
    gap: 12px;
    padding: 0 16px;
  }
  .pub-box {
    width: 22px;
    height: 22px;
    border-radius: 5px;
  }
  .pub-check {
    width: 15px;
    height: 15px;
  }
  .pub-title {
    font-size: 15px;
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
  .err-text {
    font-size: 13px;
  }
}
</style>
