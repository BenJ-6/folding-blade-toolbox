<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { Eraser, Info, LoaderCircle, ScanSearch } from "lucide-vue-next";
import DropZone from "@/components/DropZone.vue";
import PageHeader from "@/components/PageHeader.vue";
import TaskFileList from "@/components/TaskFileList.vue";
import { useFileDrop } from "@/composables/useFileDrop";
import { createImageTaskQueue } from "@/composables/imageTaskQueue";
import { useToast } from "@/composables/useToast";
import { inspectImage, isTauri, stripMetadata, type ImageMeta } from "@/lib/backend";
import { guessMime, saveImage } from "@/lib/files";
import { formatBytes, formatDims } from "@/lib/format";

const { notify } = useToast();
const queue = createImageTaskQueue();

const { items, selectedId, selectedItem, picking } = queue;

const metas = reactive<Record<string, ImageMeta>>({});
const errors = reactive<Record<string, string>>({});
const loadingId = ref("");
const cleaning = ref(false);

const desktop = isTauri();
const meta = computed(() => (selectedItem.value ? metas[selectedItem.value.id] : undefined));
const loading = computed(() => loadingId.value === selectedItem.value?.id);
const error = computed(() => (selectedItem.value ? (errors[selectedItem.value.id] ?? "") : ""));

watch(
  selectedItem,
  async (item) => {
    if (!item || !desktop) {
      return;
    }
    if (metas[item.id] || !item.path) {
      return;
    }
    loadingId.value = item.id;
    delete errors[item.id];
    try {
      metas[item.id] = await inspectImage(item.path);
    } catch (caught) {
      errors[item.id] = caught instanceof Error ? caught.message : String(caught);
    } finally {
      if (loadingId.value === item.id) {
        loadingId.value = "";
      }
    }
  },
  { immediate: true },
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
  } catch (caught) {
    console.error(caught);
  }
}

function handleSelect(id: string): void {
  queue.select(selectedId.value === id ? null : id);
}

async function cleanMetadata(): Promise<void> {
  const item = selectedItem.value;
  if (!item?.path || cleaning.value) {
    return;
  }

  cleaning.value = true;
  try {
    const blob = await stripMetadata(item.path, guessMime(item.name));
    const base = item.name.replace(/\.[^.]+$/, "");
    const ext = blob.type === "image/png" ? "png" : "jpg";
    const saved = await saveImage(blob, `${base}-clean.${ext}`);
    if (saved) {
      notify("已清除元数据并保存");
    }
  } catch (caught) {
    notify(caught instanceof Error ? caught.message : "清除失败，请重试");
  } finally {
    cleaning.value = false;
  }
}
</script>

<template>
  <section class="mx-auto w-full max-w-[1180px]">
    <PageHeader
      title="图片信息"
      description="查看图片尺寸与 EXIF 信息，一键清除拍摄设备、GPS 等元数据"
    />

    <p
      v-if="!desktop"
      class="mb-4 rounded-xl border border-line bg-[#fff8e6] px-4 py-3 text-[12px] leading-relaxed text-[#a16207]"
    >
      读取 EXIF 与清除元数据需要在桌面应用中使用，浏览器预览模式下不可用。
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
          empty-hint="添加图片后选择查看详细信息"
          @select="handleSelect"
          @remove="queue.remove"
          @clear="queue.clear"
          @add="handlePick"
        />
        <section
          v-else
          class="rounded-2xl border border-line bg-surface p-5 text-[12.5px] leading-relaxed text-ink-3 shadow-card"
        >
          支持 JPG / PNG / GIF。可查看相机型号、拍摄时间、曝光参数等 EXIF 字段，清除时会连同 GPS
          定位等元数据一起移除并另存为新文件，原图不受影响。
        </section>
      </div>

      <aside
        class="sticky top-5 overflow-hidden rounded-2xl border border-line bg-surface shadow-card max-[980px]:static max-[980px]:order-first"
      >
        <header class="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 class="flex items-center gap-2 text-sm font-semibold">
            <ScanSearch :size="17" class="text-brand" />
            详细信息
          </h2>
          <span
            v-if="meta"
            class="rounded-md bg-brand-soft px-2 py-0.5 text-[11px] font-semibold text-brand"
          >
            {{ meta.format }}
          </span>
        </header>

        <div class="flex flex-col gap-4 px-5 pt-4 pb-5">
          <template v-if="selectedItem">
            <div class="flex flex-col gap-2.5">
              <div class="flex items-start justify-between gap-3 border-b border-line pb-2">
                <span class="shrink-0 text-[11.5px] text-ink-3">文件名</span>
                <span class="min-w-0 text-right text-[11.5px] font-medium break-all text-ink-2">
                  {{ selectedItem.name }}
                </span>
              </div>
              <div class="flex items-start justify-between gap-3 border-b border-line pb-2">
                <span class="shrink-0 text-[11.5px] text-ink-3">尺寸</span>
                <span class="text-[11.5px] font-medium text-ink-2 tabular-nums">
                  {{ formatDims(selectedItem.width, selectedItem.height) }}
                </span>
              </div>
              <div class="flex items-start justify-between gap-3 border-b border-line pb-2">
                <span class="shrink-0 text-[11.5px] text-ink-3">体积</span>
                <span class="text-[11.5px] font-medium text-ink-2">
                  {{ formatBytes(meta?.bytes ?? selectedItem.size) }}
                </span>
              </div>
              <div class="flex items-start justify-between gap-3">
                <span class="shrink-0 text-[11.5px] text-ink-3">EXIF 字段</span>
                <span class="text-[11.5px] font-medium text-ink-2">
                  {{ meta ? meta.exif.length : "—" }}
                </span>
              </div>
            </div>

            <div
              v-if="loading"
              class="flex items-center justify-center gap-2 py-4 text-[11.5px] text-ink-3"
            >
              <LoaderCircle :size="14" class="animate-spin" />
              正在读取元数据…
            </div>

            <p
              v-else-if="error"
              class="rounded-lg bg-[#fdecec] px-3 py-2 text-[11.5px] text-danger"
            >
              {{ error }}
            </p>

            <template v-else-if="meta">
              <div
                v-if="meta.exif.length"
                class="max-h-[300px] overflow-auto rounded-lg border border-line"
              >
                <div
                  v-for="(field, index) in meta.exif"
                  :key="`${field.tag}-${index}`"
                  class="flex items-start justify-between gap-3 border-b border-line px-3 py-2 last:border-none"
                >
                  <span class="shrink-0 text-[10.5px] text-ink-3">{{ field.tag }}</span>
                  <span class="min-w-0 text-right text-[10.5px] font-medium break-words text-ink-2">
                    {{ field.value }}
                  </span>
                </div>
              </div>
              <p
                v-else
                class="rounded-lg bg-surface-2 px-3 py-2 text-[11.5px] leading-relaxed text-ink-3"
              >
                未检测到 EXIF 信息
              </p>

              <button
                type="button"
                class="inline-flex h-9 items-center justify-center gap-1.5 rounded-[9px] border border-line bg-surface text-[12px] font-medium text-ink-2 transition-colors hover:border-danger/40 hover:text-danger disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="cleaning || !desktop || !selectedItem.path"
                @click="cleanMetadata"
              >
                <LoaderCircle v-if="cleaning" :size="14" class="animate-spin" />
                <Eraser v-else :size="14" />
                清除元数据并另存
              </button>

              <p class="flex items-start gap-1.5 text-[11px] leading-relaxed text-ink-3">
                <Info :size="13" class="mt-0.5 shrink-0" />
                清除会重写 JPG / PNG 容器，移除 EXIF、XMP 与文本块，图像像素保持不变
              </p>
            </template>
          </template>

          <p v-else class="py-6 text-center text-[12px] leading-relaxed text-ink-3">
            从左侧选择一张图片<br />查看尺寸、体积与 EXIF 字段
          </p>
        </div>
      </aside>
    </div>
  </section>
</template>
