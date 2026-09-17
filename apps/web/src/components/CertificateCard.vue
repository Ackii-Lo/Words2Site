<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import QRCode from "qrcode";

const props = defineProps<{
  code: string;
  publishUrl: string | null;
  verifyUrl: string;
  domain?: string | null;
  email?: string | null;
}>();

const qrDataUrl = ref("");

onMounted(async () => {
  qrDataUrl.value = await QRCode.toDataURL(props.verifyUrl, {
    width: 480,
    margin: 1,
    color: { dark: "#1C1917", light: "#FFFFFF" },
  });
});

const displayUrl = computed(() => {
  if (props.publishUrl) return props.publishUrl;
  return props.domain ? `https://${props.domain}/` : "";
});
const isRelative = computed(
  () => !!props.publishUrl && props.publishUrl.startsWith("/"),
);
</script>

<template>
  <section class="voucher">
    <p class="v-label">你的网页地址</p>
    <a
      v-if="displayUrl"
      class="v-url"
      :href="publishUrl || undefined"
      :target="isRelative ? undefined : '_blank'"
      rel="noreferrer"
      >{{ displayUrl }}</a
    >

    <div class="v-divider"></div>

    <p class="v-stamp">凭此页面找工作人员集章</p>
    <p class="v-code">{{ code }}</p>

    <div v-if="qrDataUrl" class="v-qr">
      <img class="v-qr-img" :src="qrDataUrl" alt="核验二维码" />
    </div>

    <p class="v-no">凭证编号 · {{ code }}</p>
  </section>
</template>

<style scoped>
.voucher {
  margin-top: 25px;
  padding: 24px;
  border: 2px solid #f7d447;
  border-radius: 16px;
  background: #fff;
  text-align: center;
}
.v-label {
  font-size: 11.5px;
  color: #78716c;
}
.v-url {
  display: block;
  margin-top: 5px;
  font-size: 15px;
  font-weight: 700;
  color: #1c1917;
  word-break: break-all;
}
.v-divider {
  height: 1px;
  margin: 20px 0;
  background: #eeede9;
}
.v-stamp {
  font-size: 12px;
  color: #78716c;
}
.v-code {
  margin-top: 8px;
  font-family: ui-monospace, "IBM Plex Mono", monospace;
  font-size: 22px;
  font-weight: 800;
  letter-spacing: 1.5px;
  color: #1c1917;
}
.v-qr {
  width: 125px;
  height: 125px;
  margin: 27px auto 0;
  padding: 10px;
  border-radius: 12px;
  background: #1c1917;
  box-sizing: border-box;
}
.v-qr-img {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: 3px;
  background: #fff;
}
.v-no {
  margin-top: 17px;
  font-size: 11px;
  color: #78716c;
}
</style>
