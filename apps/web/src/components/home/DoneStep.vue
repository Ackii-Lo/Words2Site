<script setup lang="ts">
import CertificateCard from "@/components/CertificateCard.vue";

/**
 * 步骤④ 完成：自动发布后直接出凭证（父级轮询到 published 时组装 cert 传入）。
 */
defineProps<{
  cert: {
    code: string;
    publishUrl: string | null;
    verifyUrl: string;
    domain: string | null;
    email: string | null;
  };
}>();
defineEmits<{ restart: [] }>();
</script>

<template>
  <h2 class="done-title">网页发布成功！</h2>
  <CertificateCard
    :code="cert.code"
    :publish-url="cert.publishUrl"
    :verify-url="cert.verifyUrl"
    :domain="cert.domain"
    :email="cert.email"
  />
  <p v-if="cert.email" class="done-sub">
    网址也已发送到你的邮箱：{{ cert.email }}
  </p>
  <button class="btn-ghost" type="button" @click="$emit('restart')">
    帮朋友也做一个 →
  </button>
</template>

<style scoped>
.done-title {
  font-size: 18px;
  font-weight: 900;
  text-align: center;
  color: #1c1917;
}
.done-sub {
  margin-top: 12px;
  font-size: 11px;
  line-height: 1.6;
  text-align: center;
  color: rgba(28, 25, 23, 0.68);
  word-break: break-all;
}
.btn-ghost {
  width: 100%;
  height: 44px;
  margin-top: 16px;
  border: 2px solid #1c1917;
  border-radius: 4px;
  background: #ffffff;
  color: #1c1917;
  font-size: 12.5px;
  font-weight: 700;
}

/* ===== 桌面端 ===== */
@media (min-width: 900px) {
  .done-title {
    font-size: 34px;
    letter-spacing: -0.5px;
  }
  .done-sub {
    margin-top: 14px;
    font-size: 13px;
  }
  .btn-ghost {
    display: block;
    width: 300px;
    height: 60px;
    margin: 16px auto 0;
    font-size: 15px;
  }
}
</style>
