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
/* 方案二凭证卡：白底黄描边 + 硬投影 */
.voucher {
  position: relative;
  width: 251px;
  margin: 20px auto 0;
  padding: 24px 16px 22px;
  border: 3px solid #f7d447;
  border-radius: 4px;
  background: #ffffff;
  box-shadow: 6px 6px 0 #1c1917;
  text-align: center;
}
.v-label {
  font-size: 10px;
  color: rgba(28, 25, 23, 0.55);
}
.v-url {
  display: block;
  margin-top: 5px;
  font-size: 12.5px;
  font-weight: 900;
  color: #1c1917;
  word-break: break-all;
}
.v-divider {
  height: 1px;
  margin: 14px 0;
  background: rgba(28, 25, 23, 0.15);
}
.v-stamp {
  font-size: 10px;
  color: rgba(28, 25, 23, 0.55);
}
.v-code {
  margin-top: 8px;
  font-family: Consolas, Menlo, ui-monospace, monospace;
  font-size: 17px;
  font-weight: 900;
  letter-spacing: 2px;
  color: #1c1917;
}
.v-qr {
  width: 60px;
  height: 60px;
  margin: 16px auto 0;
  padding: 8px;
  border-radius: 10px;
  background: #1c1917;
  box-sizing: border-box;
}
.v-qr-img {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: 2px;
  background: #fff;
}
.v-no {
  margin-top: 14px;
  font-size: 9px;
  color: rgba(28, 25, 23, 0.5);
}

/* 桌面端（电脑版方案二定稿：520px 宽凭证卡） */
@media (min-width: 900px) {
  .voucher {
    width: 520px;
    margin: 14px auto 0;
    padding: 16px 24px;
    border-radius: 6px;
  }
  .v-label {
    font-size: 12.5px;
    color: #78716c;
  }
  .v-url {
    margin-top: 6px;
    font-size: 18px;
  }
  .v-divider {
    height: 1px;
    margin: 16px 0;
    background: #e7e5e0;
  }
  .v-stamp {
    font-size: 13px;
    color: #78716c;
  }
  .v-code {
    margin-top: 8px;
    font-size: 26px;
    letter-spacing: 2px;
  }
  .v-qr {
    width: 128px;
    height: 128px;
    margin: 14px auto 0;
    padding: 10px;
    border-radius: 12px;
  }
  .v-no {
    margin-top: 15px;
    font-size: 12px;
    color: #78716c;
  }
}
</style>
