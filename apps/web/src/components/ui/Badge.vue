<script setup lang="ts">
import { computed } from "vue";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-primary/10 text-primary",
        secondary: "bg-secondary text-secondary-foreground",
        success: "bg-emerald-500/10 text-emerald-600",
        destructive: "bg-destructive/10 text-destructive",
        warning: "bg-amber-500/10 text-amber-600",
        outline: "border text-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

const props = defineProps<{
  variant?: VariantProps<typeof badgeVariants>["variant"];
  class?: string;
}>();
const classes = computed(() =>
  cn(badgeVariants({ variant: props.variant }), props.class),
);
</script>

<template>
  <span :class="classes"><slot /></span>
</template>
