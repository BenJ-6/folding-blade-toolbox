<script setup lang="ts">
import { computed, onUnmounted, reactive, ref, watch } from "vue";
import {
  Download,
  ImageDown,
  LayoutGrid,
  LoaderCircle,
  MoveVertical,
  MoveHorizontal,
} from "lucide-vue-next";
import DropZone from "@/components/DropZone.vue";
import PageHeader from "@/components/PageHeader.vue";
import TaskFileList from "@/components/TaskFileList.vue";
import { useFileDrop } from "@/composables/useFileDrop";
import { createImageTaskQueue } from "@/composables/imageTaskQueue";
import { useToast } from "@/composables/useToast";
import { isTauri, stitchImages } from "@/lib/backend";
import { saveImage } from "@/lib/files";
import { decodeImage } from "@/lib/image";
import { formatBytes } from "@/lib/format";

const { notify } = useToast();
const queue = createImageTaskQueue();

const { items, selectedId, picking } = queue;

const options = reactive({
  direction: "vertical" as "vertical" | "horizontal" | "grid",
  gap: 0,
  columns: 2,
  background: "#FFFFFF",
});

const result = ref<{ blob: Blob; url: string; width: number; height: number } | null>(null);
const generating = ref(false);
const dirty = ref(false);

const canGenerate = computed(
  () => items.value.length > 0 && items.value.every((item) => Boolean(item.path)) && isTauri(),
);

const directions = [
  { value: "vertical" as const, label: "纵向长图", icon: MoveVertical },
  { value: "horizontal" as const, label: "横向长图", icon: MoveHorizontal },
  { value: "grid" as const, label: "网格拼图", icon: LayoutGrid },
];

watch(
  options,
  () => {
    if (result.value) {
      dirty.value = true;
    }
  },
  { deep: true },
);

onUnmounted(() => {
  if (result.value) {
    URL.revokeObjectURL(result.value.url);
  }
});

const { dragActive } = useFileDrop({
  onPaths: (paths) => {
    void queue.addPaths(paths);
  },
  onFiles: (files) => {
    void queue.addFiles(files);
  },
});

async function handlePick(): Promise<void> {
  try {
    await queue.pick();
  } catch (error) {
    console.error(error);
  }
}

function handleSelect(id: string): void {
  queue.select(selectedId.value === id ? null : id);
}

async function generate(): Promise<void> {
  if (generating.value) {
    return;
  }
  const paths = items.value.flatMap((item) => (item.path ? [item.path] : []));
  if (!paths.length) {
    notify("请先添加图片");
    return;
  }

  generating.value = true;
  try {
    const blob = await stitchImages(paths, {
      direction: options.direction,
      gap: options.gap,
      columns: options.columns,
      background: options.background,
    });
    const decoded = await decodeImage(blob);
    const width = decoded.width;
    const height = decoded.height;
    decoded.dispose();

    if (result.value) {
      URL.revokeObjectURL(result.value.url);
    }
    result.value = { blob, url: URL.createObjectURL(blob), width, height };
    dirty.value = false;
    notify("拼接完成");
  } catch (error) {
    notify(error instanceof Error ? error.message : "拼接失败，请重试");
  } finally {
    generating.value = false;
  }
}

async function download(): Promise<void> {
  if (!result.value) {
    return;
  }
  const suffix = options.direction === "grid" ? "grid" : options.direction;
  await saveImage(result.value.blob, `stitch-${suffix}.png`);
}
</script>

<template>
  <section class="mx-auto w-full max-w-[1180px]">
    <PageHeader title="长图拼接" description="把多张图片按顺序拼成纵向长图、横向长图或网格拼图" />

    <p
      v-if="!isTauri()"
      class="mb-4 rounded-xl border border-line bg-[#fff8e6] px-4 py-3 text-[12px] leading-relaxed text-[#a16207]"
    >
      大尺寸拼接由 Rust 后端完成，请在桌面应用中使用；浏览器预览模式下不可用。
    </p>

    <div class="grid grid-cols-[minmax(0,1fr)_336px] items-start gap-5 max-[980px]:grid-cols-1">
      <div class="flex min-w-0 flex-col gap-4">
        <DropZone
          :compact="items.length > 0"
          :active="dragActive"
          :picking="picking"
          @pick="handlePick"
        />
        <TaskFileList
          v-if="items.length"
          :items="items"
          :selected-id="selectedId"
          :busy="generating"
          reorderable
          empty-hint="添加图片后按列表顺序拼接"
          @select="handleSelect"
          @remove="queue.remove"
          @clear="queue.clear"
          @add="handlePick"
          @move="queue.move"
        />

        <section
          v-if="result"
          class="overflow-hidden rounded-2xl border border-line bg-surface shadow-card"
        >
          <header
            class="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3.5"
          >
            <div>
              <p class="text-sm font-semibold">拼接结果</p>
              <p class="mt-0.5 text-xs text-ink-3">
                {{ result.width }}×{{ result.height }} · {{ formatBytes(result.blob.size) }}
                <span v-if="dirty" class="text-[#a16207]">· 设置已更改，请重新生成</span>
              </p>
            </div>
            <button
              type="button"
              class="inline-flex h-[30px] items-center gap-1 rounded-lg bg-brand-soft px-2.5 text-[12.5px] font-medium text-brand transition-colors hover:bg-brand-soft-2"
              @click="download"
            >
              <Download :size="14" />
              保存 PNG
            </button>
          </header>
          <div class="max-h-[520px] overflow-auto bg-checkerboard p-4">
            <img :src="result.url" alt="拼接结果预览" class="mx-auto block h-auto max-w-full" />
          </div>
        </section>
      </div>

      <aside
        class="sticky top-5 overflow-hidden rounded-2xl border border-line bg-surface shadow-card max-[980px]:static max-[980px]:order-first"
      >
        <header class="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 class="flex items-center gap-2 text-sm font-semibold">
            <ImageDown :size="17" class="text-brand" />
            拼接设置
          </h2>
        </header>

        <div class="flex flex-col gap-5 px-5 pt-4 pb-1">
          <div class="flex flex-col gap-2">
            <p class="text-[12.5px] font-semibold text-ink-2">拼接方式</p>
            <div class="grid grid-cols-3 gap-1.5">
              <button
                v-for="direction in directions"
                :key="direction.value"
                type="button"
                class="flex h-[52px] flex-col items-center justify-center gap-1 rounded-lg border text-[11.5px] font-medium transition-colors"
                :class="
                  options.direction === direction.value
                    ? 'border-brand bg-brand-soft font-semibold text-brand'
                    : 'border-line bg-surface text-ink-2 hover:border-line-strong'
                "
                @click="options.direction = direction.value"
              >
                <component :is="direction.icon" :size="15" />
                {{ direction.label }}
              </button>
            </div>
          </div>

          <div v-if="options.direction === 'grid'" class="flex flex-col gap-2">
            <div class="flex items-center justify-between">
              <p class="text-[12.5px] font-semibold text-ink-2">每行数量</p>
              <span
                class="rounded-md bg-brand-soft px-2 py-0.5 text-[11.5px] font-semibold text-brand"
              >
                {{ options.columns }} 列
              </span>
            </div>
            <input
              v-model.number="options.columns"
              type="range"
              min="2"
              max="6"
              step="1"
              class="range-slider"
              :style="{ '--fill': `${((options.columns - 2) / 4) * 100}%` }"
            />
          </div>

          <div class="flex flex-col gap-2">
            <div class="flex items-center justify-between">
              <p class="text-[12.5px] font-semibold text-ink-2">间距</p>
              <span
                class="rounded-md bg-brand-soft px-2 py-0.5 text-[11.5px] font-semibold text-brand"
              >
                {{ options.gap }} px
              </span>
            </div>
            <input
              v-model.number="options.gap"
              type="range"
              min="0"
              max="80"
              step="1"
              class="range-slider"
              :style="{ '--fill': `${(options.gap / 80) * 100}%` }"
            />
          </div>

          <div class="flex flex-col gap-1.5">
            <p class="text-[12px] font-medium text-ink-2">背景颜色</p>
            <div class="flex items-center gap-2">
              <input
                v-model="options.background"
                type="color"
                class="size-8 shrink-0 cursor-pointer rounded-lg border border-line bg-transparent p-0.5"
                aria-label="背景颜色"
              />
              <input v-model="options.background" type="text" class="field font-mono uppercase" />
            </div>
            <p class="text-[11px] leading-relaxed text-ink-3">用于间距与网格留白区域</p>
          </div>

          <p class="rounded-lg bg-surface-2 px-3 py-2 text-[11px] leading-relaxed text-ink-3">
            {{
              options.direction === "vertical"
                ? "所有图片会统一缩放到最大宽度，按列表顺序从上到下排列"
                : options.direction === "horizontal"
                  ? "所有图片会统一缩放到最大高度，按列表顺序从左到右排列"
                  : "每张图片等比缩放到单元格内并居中"
            }}
          </p>
        </div>

        <div class="mt-4 border-t border-line px-5 py-5">
          <button
            type="button"
            class="inline-flex h-[42px] w-full items-center justify-center gap-2 rounded-[10px] bg-brand-gradient text-[13.5px] font-semibold text-white transition-all hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="!canGenerate || generating"
            @click="generate"
          >
            <LoaderCircle v-if="generating" :size="17" class="animate-spin" />
            <ImageDown v-else :size="17" />
            {{
              generating ? "正在拼接…" : `开始拼接${items.length ? `（${items.length} 张）` : ""}`
            }}
          </button>
          <p v-if="!items.length" class="mt-2 text-center text-[11.5px] text-ink-3">
            添加图片后按顺序拼接
          </p>
        </div>
      </aside>
    </div>
  </section>
</template>
