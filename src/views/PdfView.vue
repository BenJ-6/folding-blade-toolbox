<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { Download, FileText, LoaderCircle, RotateCcw } from "lucide-vue-next";
import DropZone from "@/components/DropZone.vue";
import PageHeader from "@/components/PageHeader.vue";
import TaskFileList from "@/components/TaskFileList.vue";
import { useFileDrop } from "@/composables/useFileDrop";
import { createImageTaskQueue } from "@/composables/imageTaskQueue";
import { useToast } from "@/composables/useToast";
import { formatBytes } from "@/lib/format";
import { saveImage } from "@/lib/files";
import { imagesToPdf, pdfFileName } from "@/lib/pdf";

const { notify } = useToast();
const queue = createImageTaskQueue();

const { items, selectedId, picking } = queue;

const options = reactive({
  pageSize: "a4" as "a4" | "image",
  margin: 12,
  quality: 88,
});

const name = ref("图片合集");
const result = ref<Blob | null>(null);
const generating = ref(false);
const dirty = ref(false);

const totalPages = computed(() => items.value.filter((item) => item.blob).length);

const outputName = computed(() => pdfFileName(name.value.trim() || "图片合集"));

watch(
  options,
  () => {
    if (result.value) {
      dirty.value = true;
    }
  },
  { deep: true },
);

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
  const blobs = items.value.flatMap((item) => (item.blob ? [item.blob] : []));
  if (!blobs.length) {
    notify("请先添加图片");
    return;
  }

  generating.value = true;
  try {
    result.value = await imagesToPdf(blobs, options);
    dirty.value = false;
    notify(`已生成 ${blobs.length} 页 PDF`);
  } catch (error) {
    notify(error instanceof Error ? error.message : "生成失败，请重试");
  } finally {
    generating.value = false;
  }
}

async function download(): Promise<void> {
  if (result.value) {
    await saveImage(result.value, outputName.value);
  }
}

async function handleDownload(id: string): Promise<void> {
  const item = items.value.find((entry) => entry.id === id);
  if (item?.result) {
    await saveImage(item.result.blob, item.result.fileName);
  }
}

async function handleDownloadAll(): Promise<void> {
  await download();
}

function resetOptions(): void {
  options.pageSize = "a4";
  options.margin = 12;
  options.quality = 88;
  name.value = "图片合集";
}
</script>

<template>
  <section class="mx-auto w-full max-w-[1180px]">
    <PageHeader
      title="图片转 PDF"
      description="把多张图片按顺序合并成一个 PDF，适合扫描件、证件与发票归档"
    />

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
          empty-hint="添加图片后按顺序合并为 PDF"
          @select="handleSelect"
          @remove="queue.remove"
          @clear="queue.clear"
          @add="handlePick"
          @move="queue.move"
          @download="handleDownload"
          @download-all="handleDownloadAll"
        />
      </div>

      <aside
        class="sticky top-5 overflow-hidden rounded-2xl border border-line bg-surface shadow-card max-[980px]:static max-[980px]:order-first"
      >
        <header class="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 class="flex items-center gap-2 text-sm font-semibold">
            <FileText :size="17" class="text-brand" />
            PDF 设置
          </h2>
          <button
            type="button"
            class="inline-flex items-center gap-1 text-xs text-ink-3 transition-colors hover:text-brand"
            @click="resetOptions"
          >
            <RotateCcw :size="12" />
            重置
          </button>
        </header>

        <div class="flex flex-col gap-5 px-5 pt-4 pb-1">
          <div class="flex flex-col gap-1.5">
            <p class="text-[12px] font-medium text-ink-2">文件名</p>
            <input v-model="name" type="text" class="field" placeholder="图片合集" />
          </div>

          <div class="flex flex-col gap-2">
            <p class="text-[12.5px] font-semibold text-ink-2">页面尺寸</p>
            <div class="flex items-center gap-1 rounded-lg bg-surface-2 p-1">
              <button
                type="button"
                class="inline-flex h-7 flex-1 items-center justify-center rounded-md text-[11.5px] transition-colors"
                :class="
                  options.pageSize === 'a4'
                    ? 'bg-surface font-semibold text-brand shadow-card'
                    : 'font-medium text-ink-2 hover:text-ink'
                "
                @click="options.pageSize = 'a4'"
              >
                A4 纸
              </button>
              <button
                type="button"
                class="inline-flex h-7 flex-1 items-center justify-center rounded-md text-[11.5px] transition-colors"
                :class="
                  options.pageSize === 'image'
                    ? 'bg-surface font-semibold text-brand shadow-card'
                    : 'font-medium text-ink-2 hover:text-ink'
                "
                @click="options.pageSize = 'image'"
              >
                跟随图片
              </button>
            </div>
            <p class="text-[11.5px] leading-relaxed text-ink-3">
              {{
                options.pageSize === "a4"
                  ? "每张图片单独一页，横图自动使用横向页面"
                  : "页面大小与图片一致，适合保留原始比例"
              }}
            </p>
          </div>

          <div v-if="options.pageSize === 'a4'" class="flex flex-col gap-2">
            <div class="flex items-center justify-between">
              <p class="text-[12.5px] font-semibold text-ink-2">页边距</p>
              <span
                class="rounded-md bg-brand-soft px-2 py-0.5 text-[11.5px] font-semibold text-brand"
              >
                {{ options.margin }} mm
              </span>
            </div>
            <input
              v-model.number="options.margin"
              type="range"
              min="0"
              max="30"
              step="1"
              class="range-slider"
              :style="{ '--fill': `${(options.margin / 30) * 100}%` }"
            />
          </div>

          <div class="flex flex-col gap-2">
            <div class="flex items-center justify-between">
              <p class="text-[12.5px] font-semibold text-ink-2">图片质量</p>
              <span
                class="rounded-md bg-brand-soft px-2 py-0.5 text-[11.5px] font-semibold text-brand"
              >
                {{ options.quality }}
              </span>
            </div>
            <input
              v-model.number="options.quality"
              type="range"
              min="50"
              max="100"
              step="1"
              class="range-slider"
              :style="{ '--fill': `${((options.quality - 50) / 50) * 100}%` }"
            />
            <p class="text-[11.5px] leading-relaxed text-ink-3">
              图片会转换为 JPEG 嵌入 PDF，画质越高文件越大
            </p>
          </div>

          <div
            v-if="result"
            class="flex flex-col gap-2 rounded-xl border border-line bg-surface-2 p-3"
          >
            <div class="flex items-center justify-between">
              <p class="text-[12px] font-semibold text-ink-2">已生成 PDF</p>
              <span class="text-[11px] text-ink-3">{{ formatBytes(result.size) }}</span>
            </div>
            <p class="text-[11.5px] text-ink-3">
              {{ totalPages }} 页 · {{ outputName }}
              <span v-if="dirty" class="text-[#a16207]">（设置已更改，请重新生成）</span>
            </p>
            <button
              type="button"
              class="inline-flex h-9 items-center justify-center gap-1.5 rounded-[9px] bg-brand-soft text-[12px] font-semibold text-brand transition-colors hover:bg-brand-soft-2"
              @click="download"
            >
              <Download :size="14" />
              保存 PDF
            </button>
          </div>
        </div>

        <div class="mt-4 border-t border-line px-5 py-5">
          <button
            type="button"
            class="inline-flex h-[42px] w-full items-center justify-center gap-2 rounded-[10px] bg-brand-gradient text-[13.5px] font-semibold text-white transition-all hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="!items.length || generating"
            @click="generate"
          >
            <LoaderCircle v-if="generating" :size="17" class="animate-spin" />
            <FileText v-else :size="17" />
            {{ generating ? "正在生成…" : `生成 PDF${totalPages ? `（${totalPages} 页）` : ""}` }}
          </button>
          <p v-if="!items.length" class="mt-2 text-center text-[11.5px] text-ink-3">
            先添加图片，再按顺序合并
          </p>
        </div>
      </aside>
    </div>
  </section>
</template>
