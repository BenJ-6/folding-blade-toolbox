<script setup lang="ts">
import { computed } from "vue";
import { ArrowRightLeft, LoaderCircle } from "lucide-vue-next";
import { convertQueue } from "@/stores/queues";
import type { OutputFormat } from "@/types";

const { items, options, processing, stale, progress, resetOptions, processAll, cancelProcessing } =
  convertQueue;

type TargetFormat = Exclude<OutputFormat, "source">;

const formats: { value: TargetFormat; label: string; desc: string }[] = [
  { value: "png", label: "PNG", desc: "无损，保留透明" },
  { value: "jpeg", label: "JPG", desc: "有损，体积更小" },
];

const pngColorOptions = [256, 128, 64, 32];
const backgroundPresets = ["#ffffff", "#000000"];

const qualityFill = computed<Record<string, string>>(() => ({
  "--fill": `${options.quality}%`,
}));

const hasSvg = computed(() => items.value.some((item) => /\.svg$/i.test(item.name)));
const hasGif = computed(() => items.value.some((item) => /\.gif$/i.test(item.name)));

function pickFormat(value: TargetFormat): void {
  options.targetFormat = value;
}
</script>

<template>
  <aside class="sticky top-5 overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
    <header class="flex items-center justify-between border-b border-line px-5 py-4">
      <h2 class="flex items-center gap-2 text-sm font-semibold">
        <ArrowRightLeft :size="17" class="text-brand" />
        转换设置
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
        <p class="text-[12.5px] font-semibold text-ink-2">目标格式</p>
        <div class="grid grid-cols-2 gap-2">
          <button
            v-for="format in formats"
            :key="format.value"
            type="button"
            class="flex flex-col items-start gap-0.5 rounded-[9px] border px-3 py-2 text-left transition-colors"
            :class="
              options.targetFormat === format.value
                ? 'border-brand bg-brand-soft text-brand'
                : 'border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink'
            "
            @click="pickFormat(format.value)"
          >
            <span class="text-[13px] font-semibold">{{ format.label }}</span>
            <span class="text-[11px] text-ink-3">{{ format.desc }}</span>
          </button>
        </div>
        <p class="text-[11.5px] leading-relaxed text-ink-3">
          输出扩展名随目标格式变化；源格式与目标格式相同时仅重新编码
        </p>
      </div>

      <div v-if="options.targetFormat === 'jpeg'" class="flex flex-col gap-2.5">
        <div class="flex items-center justify-between">
          <p class="text-[12.5px] font-semibold text-ink-2">JPG 质量</p>
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
        <p class="text-[11.5px] leading-relaxed text-ink-3">数值越低体积越小，画质损失越明显</p>

        <div class="flex flex-col gap-2">
          <p class="text-[12.5px] font-semibold text-ink-2">透明区域底色</p>
          <div class="flex items-center gap-2">
            <button
              v-for="color in backgroundPresets"
              :key="color"
              type="button"
              class="size-7 rounded-lg border transition-all"
              :class="
                options.background.toLowerCase() === color
                  ? 'border-brand ring-2 ring-brand-soft-2'
                  : 'border-line'
              "
              :style="{ backgroundColor: color }"
              :title="color === '#ffffff' ? '白色' : '黑色'"
              @click="options.background = color"
            />
            <label
              class="ml-auto inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-surface px-2 text-[11.5px] text-ink-3 transition-colors hover:border-line-strong"
            >
              自定义
              <input
                v-model="options.background"
                type="color"
                class="size-4 cursor-pointer rounded border-0 bg-transparent p-0"
              />
            </label>
          </div>
          <p class="text-[11.5px] leading-relaxed text-ink-3">
            JPG 不支持透明，透明像素会按该颜色铺平
          </p>
        </div>
      </div>

      <div v-if="options.targetFormat === 'png'" class="flex flex-col gap-2.5">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="text-[12.5px] font-semibold text-ink-2">PNG 有损量化</p>
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

        <p class="text-[11.5px] leading-relaxed text-ink-3">关闭时输出无损 PNG</p>
      </div>

      <div v-if="hasSvg" class="flex flex-col gap-2">
        <p class="text-[12.5px] font-semibold text-ink-2">SVG 输出倍数</p>
        <div class="grid grid-cols-3 gap-1.5">
          <button
            v-for="scale in [1, 2, 3]"
            :key="scale"
            type="button"
            class="h-8 rounded-lg border text-[11.5px] font-medium transition-colors"
            :class="
              options.rasterScale === scale
                ? 'border-brand bg-brand-soft font-semibold text-brand'
                : 'border-line bg-surface text-ink-2 hover:border-line-strong'
            "
            @click="options.rasterScale = scale"
          >
            {{ scale }}×
          </button>
        </div>
        <p class="text-[11.5px] leading-relaxed text-ink-3">
          SVG 按原始尺寸放大该倍数后栅格化，文字使用系统字体
        </p>
      </div>

      <div class="flex flex-col gap-2.5">
        <p class="text-[12.5px] font-semibold text-ink-2">文件名后缀</p>
        <input v-model="options.suffix" type="text" class="field" placeholder="留空则不加后缀" />
        <p
          v-if="!options.suffix.trim()"
          class="rounded-lg bg-[#fff8e6] px-3 py-2 text-[11.5px] leading-relaxed text-[#a16207]"
        >
          后缀为空且目标格式与源格式相同时，保存到原文件夹会覆盖原图
        </p>
      </div>

      <div v-if="hasGif" class="flex flex-col gap-2">
        <p class="rounded-lg bg-[#fff8e6] px-3 py-2 text-[11.5px] leading-relaxed text-[#a16207]">
          GIF 将只导出首帧，动画效果会丢失
        </p>
      </div>

      <p class="text-[11.5px] leading-relaxed text-ink-3">
        仅保留图片方向信息，EXIF 等其他元数据不会写入输出文件
      </p>
    </div>

    <div class="mt-4 flex flex-col gap-2 border-t border-line px-5 py-5">
      <p
        v-if="stale && !processing"
        class="rounded-lg bg-[#fff8e6] px-3 py-2 text-[11.5px] leading-relaxed text-[#a16207]"
      >
        设置已更改，当前结果已过期，请重新转换后再下载
      </p>
      <button
        type="button"
        class="inline-flex h-[42px] items-center justify-center gap-2 rounded-[10px] bg-brand-gradient text-[13.5px] font-semibold text-white transition-all hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="!items.length || processing"
        @click="processAll"
      >
        <LoaderCircle v-if="processing" :size="17" class="animate-spin" />
        <ArrowRightLeft v-else :size="17" />
        {{
          processing
            ? `转换中 ${progress.done}/${progress.total}`
            : `${stale ? "重新转换" : "开始转换"}${items.length ? `（${items.length} 张）` : ""}`
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
