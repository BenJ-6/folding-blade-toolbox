<script setup lang="ts">
import CompressSettings from "@/components/CompressSettings.vue";
import DropZone from "@/components/DropZone.vue";
import FileList from "@/components/FileList.vue";
import PageHeader from "@/components/PageHeader.vue";
import { useFileDrop } from "@/composables/useFileDrop";
import { createSampleFile } from "@/lib/sample";
import { compressQueue } from "@/stores/queues";

const { items, selectedId, picking, pick, addFiles, addPaths, select, remove, clear } =
  compressQueue;

const { dragActive } = useFileDrop({
  onPaths: (paths) => {
    void addPaths(paths);
  },
  onFiles: (files) => {
    void addFiles(files);
  },
});

async function handlePick(): Promise<void> {
  try {
    await pick();
  } catch (error) {
    console.error(error);
  }
}

async function handleSample(): Promise<void> {
  try {
    await addFiles([await createSampleFile()]);
  } catch (error) {
    console.error(error);
  }
}
</script>

<template>
  <section class="mx-auto w-full max-w-[1180px]">
    <PageHeader title="图片压缩" description="批量压缩图片体积，在画质与体积之间自由平衡" />

    <div class="grid grid-cols-[minmax(0,1fr)_336px] items-start gap-5 max-[980px]:grid-cols-1">
      <div class="flex min-w-0 flex-col gap-4">
        <DropZone
          :compact="items.length > 0"
          :active="dragActive"
          :picking="picking"
          @pick="handlePick"
          @sample="handleSample"
        />
        <FileList
          v-if="items.length"
          :items="items"
          :selected-id="selectedId"
          @select="select"
          @remove="remove"
          @clear="clear"
          @add="handlePick"
        />
      </div>

      <CompressSettings />
    </div>
  </section>
</template>
