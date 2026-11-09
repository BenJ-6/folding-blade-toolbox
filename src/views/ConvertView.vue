<script setup lang="ts">
import { computed } from "vue";
import ComparePreview from "@/components/ComparePreview.vue";
import ConvertSettings from "@/components/ConvertSettings.vue";
import DropZone from "@/components/DropZone.vue";
import FileList from "@/components/FileList.vue";
import PageHeader from "@/components/PageHeader.vue";
import { useFileDrop } from "@/composables/useFileDrop";
import { saveImage, saveMany } from "@/lib/files";
import { convertQueue } from "@/stores/queues";

const {
  items,
  selectedId,
  selectedItem,
  picking,
  processing,
  stale,
  pick,
  addFiles,
  addPaths,
  select,
  remove,
  clear,
} = convertQueue;

const { dragActive } = useFileDrop({
  onPaths: (paths) => {
    void addPaths(paths);
  },
  onFiles: (files) => {
    void addFiles(files);
  },
});

const previewItem = computed(() =>
  !stale.value && selectedItem.value?.result ? selectedItem.value : null,
);

function handleSelect(id: string): void {
  select(selectedId.value === id ? null : id);
}

async function handlePick(): Promise<void> {
  try {
    await pick();
  } catch (error) {
    console.error(error);
  }
}

async function handleDownload(id: string): Promise<void> {
  const item = items.value.find((entry) => entry.id === id);
  if (item?.result) {
    await saveImage(item.result.blob, item.result.fileName);
  }
}

async function handleDownloadAll(): Promise<void> {
  const exports = items.value.flatMap((item) =>
    item.result ? [{ blob: item.result.blob, fileName: item.result.fileName }] : [],
  );
  await saveMany(exports);
}
</script>

<template>
  <section class="mx-auto w-full max-w-[1180px]">
    <PageHeader
      title="格式转换"
      description="在 JPG 与 PNG 之间批量转换，支持 SVG 栅格化与 GIF 首帧导出"
    />

    <div class="grid grid-cols-[minmax(0,1fr)_336px] items-start gap-5 max-[980px]:grid-cols-1">
      <div class="flex min-w-0 flex-col gap-4">
        <DropZone
          :compact="items.length > 0"
          :active="dragActive"
          :picking="picking"
          @pick="handlePick"
        />
        <FileList
          v-if="items.length"
          :items="items"
          :selected-id="selectedId"
          metric="size"
          :busy="processing"
          :stale="stale"
          @select="handleSelect"
          @remove="remove"
          @clear="clear"
          @add="handlePick"
          @download="handleDownload"
          @download-all="handleDownloadAll"
        />
        <ComparePreview :item="previewItem" />
      </div>

      <ConvertSettings />
    </div>
  </section>
</template>
