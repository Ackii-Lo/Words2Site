<script setup lang="ts">
import { onMounted, ref } from "vue";
import QRCode from "qrcode";
import Card from "@/components/ui/Card.vue";
import Button from "@/components/ui/Button.vue";
import { PartyPopper, Rocket } from "lucide-vue-next";

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
    color: { dark: "#1f2937", light: "#ffffff" },
  });
});

function isRelative(u: string | null): boolean {
  return !!u && u.startsWith("/");
}
</script>

<template>
  <Card class="mx-auto max-w-sm overflow-hidden text-center">
    <div
      class="bg-gradient-to-r from-violet-600 to-fuchsia-500 px-6 py-4 text-white"
    >
      <div class="flex items-center justify-center gap-2 text-2xl font-bold">
        <PartyPopper class="h-7 w-7" /> 网页发布成功！
      </div>
      <div class="mt-1 text-sm opacity-90">凭此页面找工作人员集章</div>
    </div>

    <div class="space-y-4 px-6 py-6">
      <div>
        <div class="text-xs text-muted-foreground">凭证编号</div>
        <div class="font-mono text-3xl font-bold tracking-widest text-primary">
          {{ code }}
        </div>
      </div>

      <img
        v-if="qrDataUrl"
        :src="qrDataUrl"
        alt="核验二维码"
        class="mx-auto h-48 w-48 rounded-lg border p-1"
      />
      <p class="text-xs text-muted-foreground">工作人员扫此二维码核验</p>

      <a
        v-if="publishUrl"
        :href="publishUrl"
        :target="isRelative(publishUrl) ? undefined : '_blank'"
      >
        <Button size="xl" class="w-full"
          ><Rocket class="h-5 w-5" /> 打开我的网站</Button
        >
      </a>
      <p v-if="domain" class="font-mono text-xs text-muted-foreground">
        {{ domain }}
      </p>
      <p
        v-if="email"
        class="rounded-lg bg-muted/60 p-2 text-xs text-muted-foreground"
      >
        链接和凭证编号已发送到 {{ email }}，记得查收（含垃圾邮件箱）
      </p>
    </div>
  </Card>
</template>
