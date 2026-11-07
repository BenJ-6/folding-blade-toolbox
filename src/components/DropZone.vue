<script setup lang="ts">
import { ImagePlus, Plus, Upload } from "lucide-vue-next";

defineProps<{
  active: boolean;
  compact: boolean;
  picking: boolean;
}>();

const emit = defineEmits<{ pick: []; sample: [] }>();
</script>

<template>
  <div
    v-if="!compact"
    role="button"
    tabindex="0"
    class="cursor-pointer rounded-2xl border-[1.5px] border-dashed px-6 py-10 text-center transition-colors"
    :class="
      active
        ? 'border-brand bg-brand-soft'
        : 'border-line-strong bg-surface/80 hover:border-brand-soft-2 hover:bg-surface'
    "
    @click="emit('pick')"
    @keydown.enter.prevent="emit('pick')"
  >
    <div class="mx-auto flex max-w-[360px] flex-col items-center">
      <div class="bg-brand-soft text-brand mb-3.5 grid size-12 place-items-center rounded-[14px]">
        <Upload :size="24" :stroke-width="1.7" />
      </div>
      <p class="text-ink text-[15px] font-semibold">拖拽图片到这里</p>
      <p class="text-ink-3 mt-1 text-[12.5px]">支持 JPG / PNG / WebP / BMP，可一次添加多张</p>
      <div class="mt-4 flex items-center gap-2">
        <span
          class="bg-brand-gradient inline-flex h-9 items-center gap-1.5 rounded-[10px] px-4 text-[12.5px] font-semibold text-white shadow-[0_10px_20px_-12px_rgba(99,102,241,0.8)]"
        >
          <ImagePlus :size="15" />
          {{ picking ? "读取中…" : "选择图片" }}
        </span>
        <button
          type="button"
          class="border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink inline-flex h-9 items-center rounded-[10px] border px-3.5 text-[12.5px] font-medium transition-colors"
          @click.stop="emit('sample')"
        >
          使用示例图片
        </button>
      </div>
    </div>
  </div>

  <div
    v-else
    class="flex cursor-pointer items-center gap-3.5 rounded-[14px] border-[1.5px] border-dashed px-4 py-3.5 transition-colors"
    :class="
      active
        ? 'border-brand bg-brand-soft'
        : 'border-line-strong bg-surface/80 hover:border-brand-soft-2 hover:bg-surface'
    "
    @click="emit('pick')"
  >
    <div class="bg-brand-soft text-brand grid size-9 shrink-0 place-items-center rounded-[10px]">
      <Upload :size="18" :stroke-width="1.7" />
    </div>
    <div class="min-w-0">
      <p class="text-ink text-[13px] font-medium">继续添加图片</p>
      <p class="text-ink-3 truncate text-[11.5px]">拖拽到此，或点击选择 · JPG / PNG / WebP / BMP</p>
    </div>
    <button
      type="button"
      class="border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink ml-auto inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border px-2.5 text-[12px] font-medium transition-colors disabled:opacity-60"
      :disabled="picking"
      @click.stop="emit('pick')"
    >
      <Plus :size="14" />
      {{ picking ? "读取中…" : "添加" }}
    </button>
  </div>
</template>
