<script setup lang="ts">
import { computed } from "vue";
import { LoaderCircle, SlidersHorizontal, Zap } from "lucide-vue-next";
import { compressQueue } from "@/stores/queues";

const { items, options, processing, progress, resetOptions, processAll } = compressQueue;

const qualityFill = computed<Record<string, string>>(() => ({
  "--fill": `${options.quality}%`,
}));

const pngColorOptions = [256, 128, 64, 32];
</script>

<template>
  <aside class="sticky top-5 overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
    <header class="flex items-center justify-between border-b border-line px-5 py-4">
      <h2 class="flex items-center gap-2 text-sm font-semibold">
        <SlidersHorizontal :size="17" class="text-brand" />
        压缩设置
      </h2>
      <button
        type="button"
        class="text-xs text-ink-3 transition-colors hover:text-brand"
        @click="resetOptions"
      >
        恢复默认
      </button>
    </header>

    <div class="flex flex-col gap-5 px-5 pt-4 pb-1">
      <div class="flex flex-col gap-2.5">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="text-[12.5px] font-semibold text-ink-2">PNG 有损压缩</p>
            <p class="text-[11.5px] leading-relaxed text-ink-3">
              减少颜色数，体积最多可降 50% 以上
            </p>
          </div>
          <button
            type="button"
            role="switch"
            :aria-checked="options.pngLossy"
            class="relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors"
            :class="options.pngLossy ? 'bg-brand' : 'bg-surface-3'"
            @click="options.pngLossy = !options.pngLossy"
          >
            <span
              class="absolute top-[3px] size-4 rounded-full bg-white shadow transition-all"
              :class="options.pngLossy ? 'left-[19px]' : 'left-[3px]'"
            />
          </button>
        </div>

        <div v-if="options.pngLossy" class="grid grid-cols-4 gap-1.5">
          <button
            v-for="count in pngColorOptions"
            :key="count"
            type="button"
            class="h-8 rounded-lg border text-[11.5px] font-medium transition-colors"
            :class="
              options.pngColors === count
                ? 'border-brand bg-brand-soft font-semibold text-brand'
                : 'border-line bg-surface text-ink-2 hover:border-line-strong'
            "
            @click="options.pngColors = count"
          >
            {{ count }} 色
          </button>
        </div>

        <p class="text-[11.5px] leading-relaxed text-ink-3">仅对 PNG 生效；关闭时为无损压缩</p>
      </div>

      <div class="flex flex-col gap-2.5">
        <div class="flex items-center justify-between">
          <p class="text-[12.5px] font-semibold text-ink-2">压缩质量</p>
          <span class="rounded-md bg-brand-soft px-2 py-0.5 text-[11.5px] font-semibold text-brand">
            {{ options.quality }}
          </span>
        </div>
        <input
          v-model.number="options.quality"
          type="range"
          min="1"
          max="100"
          class="range-slider"
          :style="qualityFill"
        />
        <p class="text-[11.5px] leading-relaxed text-ink-3">
          数值越低，体积越小，画质损失越明显；仅对 JPG 生效
        </p>
      </div>

      <div class="flex flex-col gap-2.5">
        <p class="text-[12.5px] font-semibold text-ink-2">文件名后缀</p>
        <input v-model="options.suffix" type="text" class="field" placeholder="例如 -min" />
      </div>
    </div>

    <div class="mt-4 flex flex-col gap-2 border-t border-line px-5 py-5">
      <button
        type="button"
        class="inline-flex h-[42px] items-center justify-center gap-2 rounded-[10px] bg-brand-gradient text-[13.5px] font-semibold text-white transition-all hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="!items.length || processing"
        @click="processAll"
      >
        <LoaderCircle v-if="processing" :size="17" class="animate-spin" />
        <Zap v-else :size="17" />
        {{
          processing
            ? `处理中 ${progress.done}/${progress.total}`
            : `开始压缩${items.length ? `（${items.length} 张）` : ""}`
        }}
      </button>
      <p v-if="processing" class="text-center text-[11.5px] text-ink-3">正在处理，请稍候</p>
    </div>
  </aside>
</template>
