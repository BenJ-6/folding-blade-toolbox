<script setup lang="ts">
import { computed } from "vue";
import { SlidersHorizontal, Zap } from "lucide-vue-next";
import { compressQueue } from "@/stores/queues";
import type { OutputFormat } from "@/types";

const { items, options, resetOptions } = compressQueue;

const formatOptions: { value: OutputFormat; label: string }[] = [
  { value: "auto", label: "自动" },
  { value: "jpeg", label: "JPG" },
  { value: "webp", label: "WebP" },
  { value: "png", label: "PNG" },
];

const qualityFill = computed<Record<string, string>>(() => ({
  "--fill": `${options.quality}%`,
}));
</script>

<template>
  <aside class="border-line bg-surface shadow-card sticky top-5 overflow-hidden rounded-2xl border">
    <header class="border-line flex items-center justify-between border-b px-5 py-4">
      <h2 class="flex items-center gap-2 text-sm font-semibold">
        <SlidersHorizontal :size="17" class="text-brand" />
        压缩设置
      </h2>
      <button
        type="button"
        class="text-ink-3 hover:text-brand text-xs transition-colors"
        @click="resetOptions"
      >
        恢复默认
      </button>
    </header>

    <div class="flex flex-col gap-5 px-5 pt-4 pb-1">
      <div class="flex flex-col gap-2.5">
        <p class="text-ink-2 text-[12.5px] font-semibold">输出格式</p>
        <div class="border-line bg-surface-2 flex gap-0.5 rounded-[10px] border p-[3px]">
          <button
            v-for="option in formatOptions"
            :key="option.value"
            type="button"
            class="h-[30px] flex-1 rounded-lg text-[12.5px] font-medium transition-colors"
            :class="
              options.format === option.value
                ? 'bg-surface text-ink shadow-card'
                : 'text-ink-2 hover:text-ink'
            "
            @click="options.format = option.value"
          >
            {{ option.label }}
          </button>
        </div>
        <p class="text-ink-3 text-[11.5px] leading-relaxed">
          自动 = 保持原格式；JPG / WebP 支持画质压缩
        </p>
      </div>

      <div class="flex flex-col gap-2.5">
        <div class="flex items-center justify-between">
          <p class="text-ink-2 text-[12.5px] font-semibold">压缩质量</p>
          <span
            class="bg-brand-soft text-brand rounded-md px-2 py-0.5 text-[11.5px] font-semibold"
            :class="options.format === 'png' ? 'opacity-50' : ''"
          >
            {{ options.quality }}
          </span>
        </div>
        <input
          v-model.number="options.quality"
          type="range"
          min="1"
          max="100"
          class="range-slider"
          :disabled="options.format === 'png'"
          :style="qualityFill"
        />
        <p class="text-ink-3 text-[11.5px] leading-relaxed">
          {{
            options.format === "png"
              ? "PNG 为无损格式，质量参数不生效"
              : "数值越低，体积越小，画质损失越明显"
          }}
        </p>
      </div>

      <div class="flex flex-col gap-2.5">
        <p class="text-ink-2 text-[12.5px] font-semibold">文件名后缀</p>
        <input v-model="options.suffix" type="text" class="field" placeholder="例如 -min" />
      </div>
    </div>

    <div class="border-line mt-4 flex flex-col gap-2 border-t px-5 py-5">
      <button
        type="button"
        disabled
        class="bg-brand-gradient inline-flex h-[42px] items-center justify-center gap-2 rounded-[10px] text-[13.5px] font-semibold text-white opacity-50"
      >
        <Zap :size="17" />
        开始压缩{{ items.length ? `（${items.length} 张）` : "" }}
      </button>
      <p class="text-ink-3 text-center text-[11.5px]">处理内核将在下一阶段接入</p>
    </div>
  </aside>
</template>
