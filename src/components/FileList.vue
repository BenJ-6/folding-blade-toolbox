<script setup lang="ts">
import { computed } from "vue";
import { Download, LoaderCircle, Plus, X } from "lucide-vue-next";
import { formatBytes, formatDims, savedPercent } from "@/lib/format";
import type { ImageItem } from "@/types";

const props = defineProps<{
  items: ImageItem[];
  selectedId: string | null;
}>();

const emit = defineEmits<{
  select: [id: string];
  remove: [id: string];
  clear: [];
  add: [];
  download: [id: string];
  downloadAll: [];
}>();

const totalSize = computed(() => props.items.reduce((sum, item) => sum + item.size, 0));
const doneItems = computed(() => props.items.filter((item) => item.result));

function changePercent(item: ImageItem): number {
  return item.result ? savedPercent(item.size, item.result.size) : 0;
}
</script>

<template>
  <section class="border-line bg-surface shadow-card overflow-hidden rounded-2xl border">
    <header class="border-line flex items-center justify-between gap-3 border-b px-4 py-3.5">
      <div>
        <p class="text-sm font-semibold">图片列表</p>
        <p class="text-ink-3 mt-0.5 text-xs">
          共 {{ items.length }} 张 · {{ formatBytes(totalSize) }}
        </p>
      </div>
      <div class="flex gap-2">
        <button
          v-if="doneItems.length"
          type="button"
          class="bg-brand-soft text-brand hover:bg-brand-soft-2 inline-flex h-[30px] items-center gap-1 rounded-lg px-2.5 text-[12.5px] font-medium transition-colors"
          @click="emit('downloadAll')"
        >
          <Download :size="14" />
          全部下载
        </button>
        <button
          type="button"
          class="border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink inline-flex h-[30px] items-center gap-1 rounded-lg border px-2.5 text-[12.5px] font-medium transition-colors"
          @click="emit('add')"
        >
          <Plus :size="14" />
          添加
        </button>
        <button
          type="button"
          class="text-ink-3 hover:bg-surface-2 hover:text-ink-2 inline-flex h-[30px] items-center rounded-lg border border-transparent px-2.5 text-[12.5px] font-medium transition-colors"
          @click="emit('clear')"
        >
          清空
        </button>
      </div>
    </header>

    <div class="flex flex-col gap-1 p-2">
      <div
        v-for="item in items"
        :key="item.id"
        class="flex cursor-pointer items-center gap-3 rounded-[10px] border px-2.5 py-2 transition-colors"
        :class="
          item.id === selectedId
            ? 'border-brand-soft-2 bg-brand-soft'
            : 'hover:bg-surface-2 border-transparent'
        "
        @click="emit('select', item.id)"
      >
        <div
          class="border-line/60 bg-surface-3 grid size-11 shrink-0 place-items-center overflow-hidden rounded-[9px] border"
        >
          <img v-if="item.url" :src="item.url" alt="" class="size-full object-cover" />
          <LoaderCircle v-else-if="!item.error" :size="18" class="text-ink-3 animate-spin" />
          <X v-else :size="16" class="text-danger" />
        </div>

        <div class="min-w-0 flex-1">
          <p class="text-ink truncate text-[13px] font-medium">{{ item.name }}</p>
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
                <span class="text-ink-2">{{
                  formatDims(item.result.width, item.result.height)
                }}</span>
                <span>·</span>
                <span class="text-ink-2">{{ formatBytes(item.result.size) }}</span>
              </template>
            </template>
          </p>
        </div>

        <LoaderCircle
          v-if="item.status === 'processing'"
          :size="16"
          class="text-brand shrink-0 animate-spin"
        />
        <span
          v-else-if="item.result"
          class="shrink-0 rounded-full px-2 py-0.5 text-[11.5px] font-semibold"
          :class="
            changePercent(item) > 0
              ? 'bg-success-soft text-success'
              : changePercent(item) < 0
                ? 'text-danger bg-[#fdecec]'
                : 'bg-surface-3 text-ink-2'
          "
        >
          {{
            changePercent(item) > 0
              ? `−${changePercent(item)}%`
              : changePercent(item) < 0
                ? `+${Math.abs(changePercent(item))}%`
                : "持平"
          }}
        </span>

        <div class="flex shrink-0 items-center gap-1">
          <button
            v-if="item.result"
            type="button"
            class="text-ink-3 hover:bg-surface-3 hover:text-ink-2 grid size-8 place-items-center rounded-lg transition-colors"
            title="下载"
            @click.stop="emit('download', item.id)"
          >
            <Download :size="15" />
          </button>
          <button
            type="button"
            class="text-ink-3 hover:bg-surface-3 hover:text-ink-2 grid size-8 place-items-center rounded-lg transition-colors"
            title="移除"
            @click.stop="emit('remove', item.id)"
          >
            <X :size="15" />
          </button>
        </div>
      </div>
    </div>
  </section>
</template>
