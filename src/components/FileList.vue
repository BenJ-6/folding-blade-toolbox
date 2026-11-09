<script setup lang="ts">
import { computed } from "vue";
import { Download, LoaderCircle, Plus, X } from "lucide-vue-next";
import { computeTargetSize } from "@/lib/canvasProcess";
import { formatBytes, formatDims, savedPercent } from "@/lib/format";
import type { ImageItem, ProcessOptions } from "@/types";

const props = defineProps<{
  items: ImageItem[];
  selectedId: string | null;
  options?: ProcessOptions;
  metric?: "size" | "dimension";
  busy?: boolean;
  stale?: boolean;
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

const previewTargets = computed(() => {
  const targets: Record<string, { width: number; height: number }> = {};
  if (!props.options) {
    return targets;
  }
  for (const item of props.items) {
    if (item.result || !item.width || !item.height) {
      continue;
    }
    if (item.name.toLowerCase().endsWith(".svg")) {
      continue;
    }
    const target = computeTargetSize(item.width, item.height, props.options);
    if (target.width !== item.width || target.height !== item.height) {
      targets[item.id] = target;
    }
  }
  return targets;
});

function changeValue(item: ImageItem): number {
  if (!item.result) {
    return 0;
  }
  if (props.metric === "dimension") {
    if (!item.width || !item.height) {
      return 0;
    }
    const before = item.width * item.height;
    const after = item.result.width * item.result.height;
    return Math.round((1 - Math.sqrt(after / before)) * 100);
  }
  return savedPercent(item.size, item.result.size);
}

function changeLabel(item: ImageItem): string {
  const value = changeValue(item);
  if (props.metric === "dimension") {
    return value > 0 ? `缩小 ${value}%` : value < 0 ? `放大 ${Math.abs(value)}%` : "尺寸不变";
  }
  return value > 0 ? `−${value}%` : value < 0 ? `+${Math.abs(value)}%` : "持平";
}

function changeClass(item: ImageItem): string {
  const value = changeValue(item);
  if (value === 0) {
    return "bg-surface-3 text-ink-2";
  }
  if (props.metric === "dimension") {
    return "bg-brand-soft text-brand";
  }
  return value > 0 ? "bg-success-soft text-success" : "text-danger bg-[#fdecec]";
}
</script>

<template>
  <section class="border-line bg-surface shadow-card overflow-hidden rounded-2xl border">
    <header class="border-line flex items-center justify-between gap-3 border-b px-4 py-3.5">
      <div>
        <p class="text-sm font-semibold">图片列表</p>
        <p class="text-ink-3 mt-0.5 text-xs">
          共 {{ items.length }} 张 · {{ formatBytes(totalSize) }}
          <template v-if="doneItems.length"> · 点击图片查看效果预览</template>
          <template v-if="stale && !busy">
            · <span class="text-[#a16207]">设置已更改，请重新处理</span>
          </template>
        </p>
      </div>
      <div class="flex flex-wrap justify-end gap-2">
        <button
          v-if="doneItems.length"
          type="button"
          class="bg-brand-soft text-brand hover:bg-brand-soft-2 inline-flex h-[30px] items-center gap-1 rounded-lg px-2.5 text-[12.5px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40"
          :disabled="stale || busy"
          :title="stale ? '设置已更改，请重新处理' : undefined"
          @click="emit('downloadAll')"
        >
          <Download :size="14" />
          全部下载
        </button>
        <button
          type="button"
          class="border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink inline-flex h-[30px] items-center gap-1 rounded-lg border px-2.5 text-[12.5px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40"
          :disabled="busy"
          @click="emit('add')"
        >
          <Plus :size="14" />
          添加
        </button>
        <button
          type="button"
          class="text-ink-3 hover:bg-surface-2 hover:text-ink-2 inline-flex h-[30px] items-center rounded-lg border border-transparent px-2.5 text-[12.5px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40"
          :disabled="busy"
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
                <span
                  :class="
                    metric === 'dimension'
                      ? 'bg-brand-soft text-brand rounded-md px-1.5 py-0.5 font-semibold tabular-nums'
                      : 'text-ink-2'
                  "
                >
                  {{ formatDims(item.result.width, item.result.height) }}
                </span>
                <span>·</span>
                <span
                  :class="
                    metric === 'size'
                      ? 'bg-brand-soft text-brand rounded-md px-1.5 py-0.5 font-semibold'
                      : 'text-ink-2'
                  "
                >
                  {{ formatBytes(item.result.size) }}
                </span>
              </template>
              <template v-else-if="previewTargets[item.id]">
                <span>→</span>
                <span
                  class="bg-brand-soft text-brand border-brand-soft-2 rounded-md border border-dashed px-1.5 py-0.5 font-semibold tabular-nums"
                  title="预计输出尺寸"
                >
                  {{ previewTargets[item.id]?.width }}×{{ previewTargets[item.id]?.height }}
                </span>
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
          :class="changeClass(item)"
          :title="metric === 'dimension' ? '尺寸变化' : '体积变化'"
        >
          {{ changeLabel(item) }}
        </span>

        <div class="flex shrink-0 items-center gap-1">
          <button
            v-if="item.result"
            type="button"
            class="text-ink-3 hover:bg-surface-3 hover:text-ink-2 grid size-8 place-items-center rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-40"
            title="下载"
            :disabled="stale || busy"
            @click.stop="emit('download', item.id)"
          >
            <Download :size="15" />
          </button>
          <button
            type="button"
            class="text-ink-3 hover:bg-surface-3 hover:text-ink-2 grid size-8 place-items-center rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-40"
            title="移除"
            :disabled="busy"
            @click.stop="emit('remove', item.id)"
          >
            <X :size="15" />
          </button>
        </div>
      </div>
    </div>
  </section>
</template>
