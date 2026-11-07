<script setup lang="ts">
import { computed } from "vue";
import { LoaderCircle, Lock, Scaling, Unlock } from "lucide-vue-next";
import { resizeQueue } from "@/stores/queues";
import type { OutputFormat, ResizeMode } from "@/types";

const { items, options, processing, progress, resetOptions, processAll } = resizeQueue;

const resizeModes: { value: ResizeMode; label: string }[] = [
  { value: "original", label: "保持原尺寸" },
  { value: "percent", label: "按比例缩放" },
  { value: "fixed", label: "指定宽高" },
  { value: "max", label: "限制最长边" },
];

const formatOptions: { value: OutputFormat; label: string }[] = [
  { value: "auto", label: "自动" },
  { value: "jpeg", label: "JPG" },
  { value: "png", label: "PNG" },
];

const percentFill = computed<Record<string, string>>(() => ({
  "--fill": `${((options.percent - 10) / 190) * 100}%`,
}));
</script>

<template>
  <aside class="border-line bg-surface shadow-card sticky top-5 overflow-hidden rounded-2xl border">
    <header class="border-line flex items-center justify-between border-b px-5 py-4">
      <h2 class="flex items-center gap-2 text-sm font-semibold">
        <Scaling :size="17" class="text-brand" />
        尺寸设置
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
        <p class="text-ink-2 text-[12.5px] font-semibold">尺寸调整</p>
        <div class="grid grid-cols-2 gap-2">
          <button
            v-for="mode in resizeModes"
            :key="mode.value"
            type="button"
            class="h-[34px] rounded-[9px] border text-xs font-medium transition-colors"
            :class="
              options.resizeMode === mode.value
                ? 'border-brand bg-brand-soft text-brand font-semibold shadow-[0_0_0_3px_rgba(99,102,241,0.08)]'
                : 'border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink'
            "
            @click="options.resizeMode = mode.value"
          >
            {{ mode.label }}
          </button>
        </div>

        <div v-if="options.resizeMode === 'percent'" class="mt-1 flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <span class="text-ink-2 text-[12px]">缩放比例</span>
            <span
              class="bg-brand-soft text-brand rounded-md px-2 py-0.5 text-[11.5px] font-semibold"
            >
              {{ options.percent }}%
            </span>
          </div>
          <input
            v-model.number="options.percent"
            type="range"
            min="10"
            max="200"
            step="5"
            class="range-slider"
            :style="percentFill"
          />
          <p class="text-ink-3 text-[11.5px]">100% 为原始大小，最大可放大到 200%</p>
        </div>

        <div v-else-if="options.resizeMode === 'fixed'" class="mt-1 flex flex-col gap-2">
          <div class="grid grid-cols-[1fr_32px_1fr] items-center gap-2">
            <div class="relative">
              <span
                class="text-ink-3 pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-[11.5px]"
              >
                宽
              </span>
              <input
                v-model.number="options.width"
                type="number"
                min="1"
                max="8000"
                class="field pl-[26px]"
              />
            </div>
            <button
              type="button"
              class="grid size-8 place-items-center rounded-[9px] border transition-colors"
              :class="
                options.keepRatio
                  ? 'border-brand-soft-2 bg-brand-soft text-brand'
                  : 'border-line bg-surface-2 text-ink-3 hover:text-ink-2'
              "
              :title="options.keepRatio ? '已锁定比例' : '自由拉伸'"
              @click="options.keepRatio = !options.keepRatio"
            >
              <Lock v-if="options.keepRatio" :size="15" />
              <Unlock v-else :size="15" />
            </button>
            <div class="relative">
              <span
                class="text-ink-3 pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-[11.5px]"
              >
                高
              </span>
              <input
                v-model.number="options.height"
                type="number"
                min="1"
                max="8000"
                class="field pl-[26px]"
              />
            </div>
          </div>
          <p class="text-ink-3 text-[11.5px]">锁定比例时按目标框等比缩放</p>
        </div>

        <div v-else-if="options.resizeMode === 'max'" class="mt-1 flex flex-col gap-2">
          <div class="relative">
            <input
              v-model.number="options.maxSide"
              type="number"
              min="100"
              max="8000"
              class="field pr-9"
            />
            <span
              class="text-ink-3 pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-[11.5px]"
            >
              px
            </span>
          </div>
          <p class="text-ink-3 text-[11.5px]">最长边不超过该值，小图不会被放大</p>
        </div>

        <p v-else class="text-ink-3 text-[11.5px]">仅重新编码，不改变图片宽高</p>
      </div>

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
      </div>

      <div class="flex flex-col gap-2.5">
        <p class="text-ink-2 text-[12.5px] font-semibold">文件名后缀</p>
        <input v-model="options.suffix" type="text" class="field" placeholder="例如 -min" />
      </div>
    </div>

    <div class="border-line mt-4 flex flex-col gap-2 border-t px-5 py-5">
      <button
        type="button"
        class="bg-brand-gradient inline-flex h-[42px] items-center justify-center gap-2 rounded-[10px] text-[13.5px] font-semibold text-white transition-all hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="!items.length || processing"
        @click="processAll"
      >
        <LoaderCircle v-if="processing" :size="17" class="animate-spin" />
        <Scaling v-else :size="17" />
        {{
          processing
            ? `处理中 ${progress.done}/${progress.total}`
            : `开始调整${items.length ? `（${items.length} 张）` : ""}`
        }}
      </button>
      <p class="text-ink-3 text-center text-[11.5px]">
        {{ processing ? "正在本地处理，请稍候" : "图片不会离开你的电脑" }}
      </p>
    </div>
  </aside>
</template>
