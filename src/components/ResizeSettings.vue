<script setup lang="ts">
import { computed } from "vue";
import { Crop, LoaderCircle, Lock, Scaling, Unlock } from "lucide-vue-next";
import { resizeQueue } from "@/stores/queues";
import type { ResizeMode } from "@/types";

const {
  items,
  selectedItem,
  options,
  processing,
  stale,
  progress,
  resetOptions,
  processAll,
  cancelProcessing,
} = resizeQueue;

const resizeModes: { value: ResizeMode; label: string }[] = [
  { value: "original", label: "仅重新编码" },
  { value: "percent", label: "按比例缩放" },
  { value: "fixed", label: "指定宽高" },
  { value: "max", label: "限制最长边" },
  { value: "crop", label: "裁剪填充" },
];

const percentPresets = [25, 50, 75, 100];

const percentFill = computed<Record<string, string>>(() => ({
  "--fill": `${((options.percent - 10) / 190) * 100}%`,
}));

const sampleItem = computed(() => selectedItem.value ?? items.value[0] ?? null);
const isSvg = computed(() => sampleItem.value?.name.toLowerCase().endsWith(".svg") ?? false);

const widthAuto = computed(() => options.keepRatio && options.fixedSide === "height");
const heightAuto = computed(() => options.keepRatio && options.fixedSide === "width");

const widthValue = computed({
  get: () => (widthAuto.value ? "" : String(options.width)),
  set: (value: string) => {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      options.width = parsed;
    }
  },
});

const heightValue = computed({
  get: () => (heightAuto.value ? "" : String(options.height)),
  set: (value: string) => {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      options.height = parsed;
    }
  },
});

function activateSide(side: "width" | "height"): void {
  if (options.keepRatio) {
    options.fixedSide = side;
  }
}

function clampInt(value: number, min: number, max: number, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function normalizePercent(): void {
  options.percent = clampInt(options.percent, 10, 200, 100);
}

function normalizeWidth(): void {
  options.width = clampInt(options.width, 1, 8000, 1920);
}

function normalizeHeight(): void {
  options.height = clampInt(options.height, 1, 8000, 1080);
}

function normalizeMaxSide(): void {
  options.maxSide = clampInt(options.maxSide, 100, 8000, 1600);
}
</script>

<template>
  <aside class="sticky top-5 overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
    <header class="flex items-center justify-between border-b border-line px-5 py-4">
      <h2 class="flex items-center gap-2 text-sm font-semibold">
        <Scaling :size="17" class="text-brand" />
        尺寸设置
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
        <p class="text-[12.5px] font-semibold text-ink-2">尺寸调整</p>
        <div class="grid grid-cols-2 gap-2">
          <button
            v-for="mode in resizeModes"
            :key="mode.value"
            type="button"
            class="h-[34px] rounded-[9px] border text-xs font-medium transition-colors"
            :class="[
              options.resizeMode === mode.value
                ? 'border-brand bg-brand-soft font-semibold text-brand shadow-[0_0_0_3px_rgba(99,102,241,0.08)]'
                : 'border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink',
              mode.value === 'crop' ? 'col-span-2' : '',
            ]"
            @click="options.resizeMode = mode.value"
          >
            {{ mode.label }}
          </button>
        </div>

        <div v-if="options.resizeMode === 'percent'" class="mt-1 flex flex-col gap-2">
          <div class="flex items-center justify-between gap-2">
            <span class="text-[12px] text-ink-2">缩放比例</span>
            <div class="flex items-center gap-1">
              <input
                v-model.number="options.percent"
                type="number"
                min="10"
                max="200"
                step="1"
                class="field h-7 w-16 px-2 text-right text-[11.5px] font-semibold"
                @change="normalizePercent"
              />
              <span class="text-[11.5px] text-ink-3">%</span>
            </div>
          </div>
          <input
            v-model.number="options.percent"
            type="range"
            min="10"
            max="200"
            step="1"
            class="range-slider"
            :style="percentFill"
          />
          <div class="flex gap-1.5">
            <button
              v-for="preset in percentPresets"
              :key="preset"
              type="button"
              class="h-7 flex-1 rounded-lg border text-[11px] font-medium transition-colors"
              :class="
                options.percent === preset
                  ? 'border-brand bg-brand-soft text-brand'
                  : 'border-line bg-surface text-ink-2 hover:border-line-strong'
              "
              @click="options.percent = preset"
            >
              {{ preset }}%
            </button>
          </div>
          <p class="text-[11.5px] text-ink-3">100% 为原始大小，可输入 10%–200%</p>
        </div>

        <div v-else-if="options.resizeMode === 'fixed'" class="mt-1 flex flex-col gap-2">
          <div class="grid grid-cols-[1fr_32px_1fr] items-center gap-2">
            <div class="relative" @click="activateSide('width')">
              <span
                class="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-[11.5px] text-ink-3"
              >
                宽
              </span>
              <input
                v-model="widthValue"
                type="number"
                min="1"
                max="8000"
                class="field pl-[26px]"
                :class="widthAuto ? 'cursor-pointer text-ink-3' : ''"
                :placeholder="widthAuto ? '自动' : ''"
                :readonly="widthAuto"
                @focus="activateSide('width')"
                @change="normalizeWidth"
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
            <div class="relative" @click="activateSide('height')">
              <span
                class="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-[11.5px] text-ink-3"
              >
                高
              </span>
              <input
                v-model="heightValue"
                type="number"
                min="1"
                max="8000"
                class="field pl-[26px]"
                :class="heightAuto ? 'cursor-pointer text-ink-3' : ''"
                :placeholder="heightAuto ? '自动' : ''"
                :readonly="heightAuto"
                @focus="activateSide('height')"
                @change="normalizeHeight"
              />
            </div>
          </div>
          <p class="text-[11.5px] text-ink-3">
            锁定比例时只填一侧，另一侧显示“自动”并按原图比例计算，点击可切换；解锁后拉伸到目标尺寸
          </p>
        </div>

        <div v-else-if="options.resizeMode === 'max'" class="mt-1 flex flex-col gap-2">
          <div class="relative">
            <input
              v-model.number="options.maxSide"
              type="number"
              min="100"
              max="8000"
              class="field pr-9"
              @change="normalizeMaxSide"
            />
            <span
              class="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-[11.5px] text-ink-3"
            >
              px
            </span>
          </div>
          <p class="text-[11.5px] text-ink-3">最长边不超过该值，小图不会被放大</p>
        </div>

        <div v-else-if="options.resizeMode === 'crop'" class="mt-1 flex flex-col gap-2">
          <div class="grid grid-cols-[1fr_32px_1fr] items-center gap-2">
            <div class="relative">
              <span
                class="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-[11.5px] text-ink-3"
              >
                宽
              </span>
              <input
                v-model.number="options.width"
                type="number"
                min="1"
                max="8000"
                class="field pl-[26px]"
                @change="normalizeWidth"
              />
            </div>
            <div class="grid size-8 place-items-center rounded-[9px] bg-brand-soft text-brand">
              <Crop :size="15" />
            </div>
            <div class="relative">
              <span
                class="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-[11.5px] text-ink-3"
              >
                高
              </span>
              <input
                v-model.number="options.height"
                type="number"
                min="1"
                max="8000"
                class="field pl-[26px]"
                @change="normalizeHeight"
              />
            </div>
          </div>
          <p class="text-[11.5px] text-ink-3">按比例填满目标框后居中裁剪，输出尺寸精确且不拉伸</p>
        </div>

        <p v-else class="text-[11.5px] text-ink-3">不改变宽高，仅以较高画质重新编码</p>

        <p
          v-if="isSvg"
          class="rounded-lg bg-[#fff8e6] px-3 py-2 text-[11.5px] leading-relaxed text-[#a16207]"
        >
          SVG 是矢量图，尺寸设置不生效，仅做无损精简
        </p>
      </div>

      <div class="flex flex-col gap-2.5">
        <p class="text-[12.5px] font-semibold text-ink-2">文件名后缀</p>
        <input v-model="options.suffix" type="text" class="field" placeholder="例如 -min" />
        <p
          v-if="!options.suffix.trim()"
          class="rounded-lg bg-[#fff8e6] px-3 py-2 text-[11.5px] leading-relaxed text-[#a16207]"
        >
          后缀为空，保存到原文件夹会覆盖原图
        </p>
      </div>
    </div>

    <div class="mt-4 flex flex-col gap-2 border-t border-line px-5 py-5">
      <p
        v-if="stale && !processing"
        class="rounded-lg bg-[#fff8e6] px-3 py-2 text-[11.5px] leading-relaxed text-[#a16207]"
      >
        设置已更改，当前结果已过期，请重新处理后再下载
      </p>
      <button
        type="button"
        class="inline-flex h-[42px] items-center justify-center gap-2 rounded-[10px] bg-brand-gradient text-[13.5px] font-semibold text-white transition-all hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="!items.length || processing"
        @click="processAll"
      >
        <LoaderCircle v-if="processing" :size="17" class="animate-spin" />
        <Scaling v-else :size="17" />
        {{
          processing
            ? `处理中 ${progress.done}/${progress.total}`
            : `${stale ? "重新调整" : "开始调整"}${items.length ? `（${items.length} 张）` : ""}`
        }}
      </button>
      <div class="flex items-center justify-center gap-2 text-[11.5px] text-ink-3">
        <span>{{ processing ? "正在本地处理，请稍候" : "图片不会离开你的电脑" }}</span>
        <button
          v-if="processing"
          type="button"
          class="text-danger hover:underline"
          @click="cancelProcessing"
        >
          取消
        </button>
      </div>
    </div>
  </aside>
</template>
