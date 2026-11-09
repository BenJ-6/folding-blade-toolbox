<script setup lang="ts">
import { ref } from "vue";
import { QrCode, ScanLine } from "lucide-vue-next";
import PageHeader from "@/components/PageHeader.vue";
import QrGenerator from "@/components/QrGenerator.vue";
import QrScanner from "@/components/QrScanner.vue";

const tab = ref<"generate" | "scan">("generate");

const tabs = [
  { value: "generate" as const, label: "生成二维码", icon: QrCode },
  { value: "scan" as const, label: "识别二维码", icon: ScanLine },
];
</script>

<template>
  <section class="mx-auto w-full max-w-[1180px]">
    <PageHeader title="二维码" description="把链接、文字、Wi-Fi 变成二维码，也能从图片里读出二维码" />

    <div
      class="border-line bg-surface shadow-card mb-4 inline-flex items-center gap-1 rounded-xl border p-1"
    >
      <button
        v-for="item in tabs"
        :key="item.value"
        type="button"
        class="inline-flex h-9 items-center gap-2 rounded-lg px-4 text-[13px] transition-colors"
        :class="
          tab === item.value
            ? 'bg-brand-soft text-brand font-semibold'
            : 'text-ink-2 hover:bg-surface-2 font-medium'
        "
        @click="tab = item.value"
      >
        <component :is="item.icon" :size="16" />
        {{ item.label }}
      </button>
    </div>

    <QrGenerator v-if="tab === 'generate'" />
    <QrScanner v-else />
  </section>
</template>
