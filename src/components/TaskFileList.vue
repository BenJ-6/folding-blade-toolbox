<script setup lang="ts">
import { computed } from "vue";
import { ArrowDown, ArrowUp, Download, LoaderCircle, Plus, X } from "lucide-vue-next";
import { formatBytes, formatDims } from "@/lib/format";
import type { ImageItem } from "@/types";

const props = withDefaults(
  defineProps<{
    items: ImageItem[];
    selectedId: string | null;
    busy?: boolean;
    reorderable?: boolean;
    emptyHint?: string;
  }>(),
  { busy: false, reorderable: false, emptyHint: "添加图片后显示在这里" },
);

const emit = defineEmits<{
  select: [id: string];
  remove: [id: string];
  clear: [];
  add: [];
  download: [id: string];
  downloadAll: [];
  move: [id: string, offset: number];
}>();

const totalSize = computed(() => props.items.reduce((sum, item) => sum + item.size, 0));
const doneItems = computed(() => props.items.filter((item) => item.result));
</script>

<template>
  <section class="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
    <header class="flex items-center justify-between gap-3 border-b border-line px-4 py-3.5">
      <div class="min-w-0">
        <p class="text-sm font-semibold">图片列表</p>
        <p class="mt-0.5 truncate text-xs text-ink-3">
          共 {{ items.length }} 张 · {{ formatBytes(totalSize) }}
          <template v-if="reorderable"> · 可用箭头调整顺序</template>
        </p>
      </div>
      <div class="flex flex-wrap justify-end gap-2">
        <button
          v-if="doneItems.length"
          type="button"
          class="inline-flex h-[30px] items-center gap-1 rounded-lg bg-brand-soft px-2.5 text-[12.5px] font-medium text-brand transition-colors hover:bg-brand-soft-2 disabled:cursor-not-allowed disabled:opacity-40"
          :disabled="busy"
          @click="emit('downloadAll')"
        >
          <Download :size="14" />
          全部下载
        </button>
        <button
          type="button"
          class="inline-flex h-[30px] items-center gap-1 rounded-lg border border-line bg-surface px-2.5 text-[12.5px] font-medium text-ink-2 transition-colors hover:border-line-strong hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
          :disabled="busy"
          @click="emit('add')"
        >
          <Plus :size="14" />
          添加
        </button>
        <button
          type="button"
          class="inline-flex h-[30px] items-center rounded-lg border border-transparent px-2.5 text-[12.5px] font-medium text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink-2 disabled:cursor-not-allowed disabled:opacity-40"
          :disabled="busy"
          @click="emit('clear')"
        >
          清空
        </button>
      </div>
    </header>

    <div v-if="items.length" class="flex flex-col gap-1 p-2">
      <div
        v-for="(item, index) in items"
        :key="item.id"
        class="flex cursor-pointer items-center gap-3 rounded-[10px] border px-2.5 py-2 transition-colors"
        :class="
          item.id === selectedId
            ? 'border-brand-soft-2 bg-brand-soft'
            : 'border-transparent hover:bg-surface-2'
        "
        @click="emit('select', item.id)"
      >
        <span
          v-if="reorderable"
          class="w-5 shrink-0 text-center text-[11px] font-semibold text-ink-3 tabular-nums"
        >
          {{ index + 1 }}
        </span>

        <div
          class="grid size-11 shrink-0 place-items-center overflow-hidden rounded-[9px] border border-line/60 bg-surface-3"
        >
          <img v-if="item.url" :src="item.url" alt="" class="size-full object-cover" />
          <LoaderCircle v-else-if="!item.error" :size="18" class="animate-spin text-ink-3" />
          <X v-else :size="16" class="text-danger" />
        </div>

        <div class="min-w-0 flex-1">
          <p class="truncate text-[13px] font-medium text-ink">{{ item.name }}</p>
          <p
            class="mt-0.5 flex flex-wrap items-center gap-1 text-[11.5px]"
            :class="item.error ? 'text-danger' : 'text-ink-3'"
          >
            <template v-if="item.error">{{ item.error }}</template>
            <template v-else-if="!item.width">读取中…</template>
            <template v-else>
              <span>{{ formatDims(item.width, item.height) }}</span>
              <span>·</span>
              <span>{{ formatBytes(item.size) }}</span>
              <template v-if="item.result">
                <span>→</span>
                <span class="rounded-md bg-brand-soft px-1.5 py-0.5 font-semibold text-brand">
                  {{ formatBytes(item.result.size) }}
                </span>
              </template>
            </template>
          </p>
        </div>

        <LoaderCircle
          v-if="item.status === 'processing'"
          :size="16"
          class="shrink-0 animate-spin text-brand"
        />

        <div class="flex shrink-0 items-center gap-1">
          <template v-if="reorderable">
            <button
              type="button"
              class="grid size-7 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-surface-3 hover:text-ink-2 disabled:opacity-30"
              title="上移"
              :disabled="busy || index === 0"
              @click.stop="emit('move', item.id, -1)"
            >
              <ArrowUp :size="14" />
            </button>
            <button
              type="button"
              class="grid size-7 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-surface-3 hover:text-ink-2 disabled:opacity-30"
              title="下移"
              :disabled="busy || index === items.length - 1"
              @click.stop="emit('move', item.id, 1)"
            >
              <ArrowDown :size="14" />
            </button>
          </template>
          <button
            v-if="item.result"
            type="button"
            class="grid size-8 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-surface-3 hover:text-ink-2 disabled:opacity-40"
            title="下载"
            :disabled="busy"
            @click.stop="emit('download', item.id)"
          >
            <Download :size="15" />
          </button>
          <button
            type="button"
            class="grid size-8 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-surface-3 hover:text-ink-2 disabled:opacity-40"
            title="移除"
            :disabled="busy"
            @click.stop="emit('remove', item.id)"
          >
            <X :size="15" />
          </button>
        </div>
      </div>
    </div>

    <p v-else class="px-4 py-8 text-center text-[12.5px] text-ink-3">{{ emptyHint }}</p>
  </section>
</template>
