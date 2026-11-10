<script setup lang="ts">
import { ref } from "vue";
import { Blend, Contrast, Palette, Pipette } from "lucide-vue-next";
import ColorLab from "@/components/ColorLab.vue";
import ContrastChecker from "@/components/ContrastChecker.vue";
import GradientBuilder from "@/components/GradientBuilder.vue";
import ImagePalette from "@/components/ImagePalette.vue";
import PageHeader from "@/components/PageHeader.vue";
import { useToast } from "@/composables/useToast";

type ColorTab = "lab" | "gradient" | "contrast" | "image";

const { message } = useToast();

const tab = ref<ColorTab>("lab");
const color = ref("#5B5CF0");

const tabs = [
  { value: "lab" as const, label: "调色盘", icon: Palette },
  { value: "gradient" as const, label: "渐变", icon: Blend },
  { value: "contrast" as const, label: "对比度", icon: Contrast },
  { value: "image" as const, label: "图片取色", icon: Pipette },
];

function handleUseColor(value: string): void {
  color.value = value.toUpperCase();
  tab.value = "lab";
}
</script>

<template>
  <section class="mx-auto w-full max-w-[1180px]">
    <PageHeader title="颜色工具" description="取色、格式转换、配色、渐变与对比度检查，一站完成" />

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

    <KeepAlive>
      <ColorLab v-if="tab === 'lab'" v-model="color" />
      <GradientBuilder v-else-if="tab === 'gradient'" />
      <ContrastChecker v-else-if="tab === 'contrast'" />
      <ImagePalette v-else @use-color="handleUseColor" />
    </KeepAlive>

    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="translate-y-2 opacity-0"
        enter-to-class="translate-y-0 opacity-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="message"
          class="bg-ink pointer-events-none fixed bottom-8 left-1/2 z-50 -translate-x-1/2 rounded-full px-4 py-2 text-[12.5px] font-medium text-white shadow-lg"
        >
          {{ message }}
        </div>
      </Transition>
    </Teleport>
  </section>
</template>
