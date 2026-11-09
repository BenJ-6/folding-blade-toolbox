<script setup lang="ts">
import { computed, ref } from "vue";
import { Download, Maximize2, Minimize2, MoveHorizontal } from "lucide-vue-next";
import { saveImage } from "@/lib/files";
import { formatBytes, savedPercent } from "@/lib/format";
import type { ImageItem } from "@/types";

const props = defineProps<{ item: ImageItem | null }>();

const position = ref(50);
const actualSize = ref(false);
const canvas = ref<HTMLElement | null>(null);
let dragging = false;

const result = computed(() => props.item?.result ?? null);
const change = computed(() =>
  props.item && result.value ? savedPercent(props.item.size, result.value.size) : 0,
);

const viewportStyle = computed<Record<string, string>>(() => ({
  "--pos": `${position.value}%`,
}));

const beforeStyle = computed(() => ({
  clipPath: `inset(0 ${100 - position.value}% 0 0)`,
}));

const canvasStyle = computed<Record<string, string>>(() => {
  const item = props.item;
  const output = result.value;
  if (!actualSize.value || !item || !output) {
    return { width: "100%", height: "100%" };
  }
  return {
    width: `${Math.max(item.width, output.width, 1)}px`,
    height: `${Math.max(item.height, output.height, 1)}px`,
  };
});

function imageStyle(width: number, height: number): Record<string, string> {
  return actualSize.value
    ? { width: `${Math.max(width, 1)}px`, height: `${Math.max(height, 1)}px` }
    : { width: "100%", height: "100%" };
}

function updatePosition(clientX: number): void {
  const target = canvas.value;
  if (!target) {
    return;
  }
  const rect = target.getBoundingClientRect();
  const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  position.value = ratio * 100;
}

function onPointerDown(event: PointerEvent): void {
  dragging = true;
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  updatePosition(event.clientX);
}

function onPointerMove(event: PointerEvent): void {
  if (dragging) {
    updatePosition(event.clientX);
  }
}

function onPointerUp(): void {
  dragging = false;
}

async function download(): Promise<void> {
  if (props.item?.result) {
    await saveImage(props.item.result.blob, props.item.result.fileName);
  }
}
</script>

<template>
  <section
    v-if="item && result"
    class="border-line bg-surface shadow-card overflow-hidden rounded-2xl border"
  >
    <header
      class="border-line flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3.5"
    >
      <div>
        <p class="text-sm font-semibold">效果预览</p>
        <p class="text-ink-3 mt-0.5 text-xs">{{ item.name }}</p>
      </div>
      <div class="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          class="border-line bg-surface-2 text-ink-2 hover:border-line-strong inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11.5px] transition-colors"
          @click="actualSize = !actualSize"
        >
          <Minimize2 v-if="actualSize" :size="13" />
          <Maximize2 v-else :size="13" />
          {{ actualSize ? "适应窗口" : "实际像素" }}
        </button>
        <span
          class="border-line bg-surface-2 text-ink-2 rounded-full border px-2.5 py-1 text-[11.5px]"
        >
          {{ item.width }}×{{ item.height }} → {{ result.width }}×{{ result.height }}
        </span>
        <span
          class="border-line bg-surface-2 text-ink-2 rounded-full border px-2.5 py-1 text-[11.5px]"
        >
          {{ formatBytes(item.size) }} → {{ formatBytes(result.size) }}
        </span>
        <span
          class="rounded-full px-2.5 py-1 text-[11.5px] font-semibold"
          :class="
            change > 0
              ? 'bg-success-soft text-success'
              : change < 0
                ? 'text-danger bg-[#fdecec]'
                : 'bg-surface-3 text-ink-2'
          "
        >
          {{
            change > 0 ? `节省 ${change}%` : change < 0 ? `增大 ${Math.abs(change)}%` : "体积不变"
          }}
        </span>
      </div>
    </header>

    <div
      class="border-line bg-surface-2 relative mx-4 mt-4 h-[300px] cursor-ew-resize touch-none rounded-xl border select-none"
      :class="actualSize ? 'overflow-auto' : 'overflow-hidden'"
      :style="viewportStyle"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
    >
      <div ref="canvas" class="relative" :style="canvasStyle">
        <img
          :src="result.url"
          alt=""
          class="pointer-events-none absolute top-0 left-0 object-contain"
          :style="imageStyle(result.width, result.height)"
          draggable="false"
        />
        <div class="absolute inset-0" :style="beforeStyle">
          <img
            :src="item.url"
            alt=""
            class="pointer-events-none absolute top-0 left-0 object-contain"
            :style="imageStyle(item.width, item.height)"
            draggable="false"
          />
        </div>

        <div
          class="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.12)]"
          :style="{ left: `${position}%` }"
        >
          <span
            class="absolute top-1/2 left-1/2 grid size-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white text-[#161a26] shadow-[0_6px_18px_rgba(0,0,0,0.28)]"
          >
            <MoveHorizontal :size="17" />
          </span>
        </div>
      </div>

      <span
        class="absolute top-3 left-3 rounded-full bg-[rgba(14,18,32,0.68)] px-2.5 py-1 text-[11.5px] font-semibold text-white backdrop-blur"
      >
        原图
      </span>
      <span
        class="absolute top-3 right-3 rounded-full bg-[rgba(14,18,32,0.68)] px-2.5 py-1 text-[11.5px] font-semibold text-white backdrop-blur"
      >
        处理后
      </span>
    </div>

    <footer class="flex items-center justify-between gap-3 px-4 py-4">
      <span class="text-ink-3 text-xs">
        {{
          actualSize ? "按实际像素显示，可滚动查看细节" : "拖动滑块对比处理前后，或切换实际像素查看"
        }}
      </span>
      <button
        type="button"
        class="bg-brand-soft text-brand hover:bg-brand-soft-2 inline-flex h-[30px] items-center gap-1 rounded-lg px-2.5 text-[12.5px] font-medium transition-colors"
        @click="download"
      >
        <Download :size="14" />
        下载此图
      </button>
    </footer>
  </section>
</template>
