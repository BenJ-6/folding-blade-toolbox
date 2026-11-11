<script setup lang="ts">
import { computed, nextTick, onActivated, onBeforeUnmount, onDeactivated, ref } from "vue";
import { Copy, ImageDown, Pipette, Trash2, Upload } from "lucide-vue-next";
import { useFileDrop } from "@/composables/useFileDrop";
import { useRecentColors } from "@/composables/useRecentColors";
import { useToast } from "@/composables/useToast";
import { copyText } from "@/lib/clipboard";
import { extractPalette, readableTextColor, rgbToHex } from "@/lib/color";
import { pickImages, readImageFile } from "@/lib/files";

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif", "bmp", "svg"];
const MAX_EDGE = 1400;

const STEPS = [
  { title: "载入图片", desc: "点击选择，或把图片拖到页面任意位置" },
  { title: "悬停取色", desc: "鼠标移到图片上，即可看到该像素的颜色" },
  { title: "复制或继续编辑", desc: "点击复制色值，或一键送到调色盘" },
];

const emit = defineEmits<{ "use-color": [value: string] }>();
const { notify } = useToast();
const { add } = useRecentColors();

const canvasRef = ref<HTMLCanvasElement | null>(null);
const imageName = ref("");
const imageSize = ref("");
const ready = ref(false);
const picking = ref(false);
const palette = ref<string[]>([]);
const picked = ref<string[]>([]);
const hover = ref<{ x: number; y: number; hex: string } | null>(null);
const active = ref(true);

let imageData: ImageData | null = null;
let objectUrl = "";
let loadToken = 0;

const { dragActive } = useFileDrop({
  isActive: () => active.value,
  onFiles: (files) => {
    const file = files.find((item) => item.type.startsWith("image/") || isImageName(item.name));
    if (file) {
      void loadBlob(file, file.name);
    }
  },
  onPaths: (paths) => {
    const path = paths.find(isImageName);
    if (path) {
      void loadPath(path);
    }
  },
});

onActivated(() => {
  active.value = true;
});

onDeactivated(() => {
  active.value = false;
  dragActive.value = false;
  hover.value = null;
});

onBeforeUnmount(() => {
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl);
  }
});

const currentColor = computed(
  () => hover.value?.hex ?? picked.value[0] ?? palette.value[0] ?? null,
);

const tooltipStyle = computed((): Record<string, string> => {
  if (!hover.value) {
    return {};
  }
  const below = hover.value.y < 56;
  return {
    left: `${hover.value.x}px`,
    top: `${hover.value.y + (below ? 14 : -14)}px`,
    transform: below ? "translate(-50%, 0)" : "translate(-50%, -100%)",
  };
});

function isImageName(name: string): boolean {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return IMAGE_EXTENSIONS.includes(ext);
}

async function pick(): Promise<void> {
  if (picking.value) {
    return;
  }
  picking.value = true;
  try {
    const [file] = await pickImages(IMAGE_EXTENSIONS);
    if (!file) {
      return;
    }
    const blob = await readImageFile(file);
    await loadBlob(blob, file.name);
  } catch {
    notify("图片读取失败，请换一张试试");
  } finally {
    picking.value = false;
  }
}

async function loadPath(path: string): Promise<void> {
  const name = path.split(/[\\/]/).pop() ?? "image";
  try {
    const blob = await readImageFile({ path, name });
    await loadBlob(blob, name);
  } catch {
    notify("图片读取失败，请换一张试试");
  }
}

async function loadBlob(blob: Blob, name: string): Promise<void> {
  const token = ++loadToken;
  const url = URL.createObjectURL(blob);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("decode failed"));
      element.src = url;
    });

    if (token !== loadToken) {
      URL.revokeObjectURL(url);
      return;
    }

    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
    }
    objectUrl = url;

    imageName.value = name;
    imageSize.value = `${image.naturalWidth} × ${image.naturalHeight} px`;
    ready.value = true;
    hover.value = null;
    picked.value = [];
    await nextTick();

    const canvas = canvasRef.value;
    if (!canvas) {
      return;
    }

    const scale = Math.min(1, MAX_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) {
      notify("无法读取图片像素，请换一张试试");
      return;
    }

    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    palette.value = extractPalette(imageData, 8);
    notify(`已载入 ${name}`);
  } catch {
    URL.revokeObjectURL(url);
    notify("图片读取失败，请换一张试试");
  }
}

function reset(): void {
  loadToken += 1;
  ready.value = false;
  imageData = null;
  palette.value = [];
  picked.value = [];
  hover.value = null;
  imageName.value = "";
  imageSize.value = "";
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl);
    objectUrl = "";
  }
}

function sampleAt(event: MouseEvent): { hex: string; x: number; y: number } | null {
  const canvas = canvasRef.value;
  if (!canvas || !imageData) {
    return null;
  }
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) {
    return null;
  }
  const px = Math.floor(((event.clientX - rect.left) / rect.width) * canvas.width);
  const py = Math.floor(((event.clientY - rect.top) / rect.height) * canvas.height);
  const x = Math.min(canvas.width - 1, Math.max(0, px));
  const y = Math.min(canvas.height - 1, Math.max(0, py));
  const offset = (y * canvas.width + x) * 4;
  const data = imageData.data;
  const alpha = data[offset + 3] / 255;
  const blend = (channel: number): number => Math.round(channel * alpha + 255 * (1 - alpha));
  return {
    hex: rgbToHex({
      r: blend(data[offset]),
      g: blend(data[offset + 1]),
      b: blend(data[offset + 2]),
    }).toUpperCase(),
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

function onMove(event: MouseEvent): void {
  const result = sampleAt(event);
  if (!result) {
    return;
  }
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  hover.value = {
    hex: result.hex,
    x: Math.min(Math.max(result.x, 54), Math.max(54, rect.width - 54)),
    y: result.y,
  };
}

function onLeave(): void {
  hover.value = null;
}

async function pickAt(event: MouseEvent): Promise<void> {
  const result = sampleAt(event);
  if (!result) {
    return;
  }
  const value = result.hex;
  picked.value = [value, ...picked.value.filter((item) => item !== value)].slice(0, 12);
  add(value);
  const ok = await copyText(value);
  notify(ok ? `已复制 ${value}` : `已取色 ${value}`);
}

async function copyColor(hex: string): Promise<void> {
  const value = hex.toUpperCase();
  picked.value = [value, ...picked.value.filter((item) => item !== value)].slice(0, 12);
  add(value);
  const ok = await copyText(value);
  notify(ok ? `已复制 ${value}` : "复制失败，请重试");
}

function openInLab(): void {
  const value = currentColor.value;
  if (!value) {
    return;
  }
  emit("use-color", value.toUpperCase());
}

function clearPicked(): void {
  picked.value = [];
}
</script>

<template>
  <div>
    <div
      v-if="!ready"
      class="grid grid-cols-[minmax(0,1fr)_320px] items-start gap-4 max-[900px]:grid-cols-1"
    >
      <section class="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
        <header class="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 class="flex items-center gap-2 text-sm font-semibold">
            <Pipette :size="17" class="text-brand" />
            图片取色
          </h2>
          <span class="text-[11.5px] text-ink-3">支持 PNG / JPG / WebP / GIF / BMP</span>
        </header>
        <div class="px-5 pt-4 pb-5">
          <div
            role="button"
            tabindex="0"
            class="cursor-pointer rounded-xl border-[1.5px] border-dashed px-6 py-14 text-center transition-colors"
            :class="
              dragActive
                ? 'border-brand bg-brand-soft'
                : 'border-line-strong bg-surface-2/70 hover:border-brand-soft-2 hover:bg-surface'
            "
            @click="pick"
            @keydown.enter.prevent="pick"
          >
            <div class="mx-auto flex max-w-[380px] flex-col items-center">
              <div
                class="mb-3.5 grid size-12 place-items-center rounded-[14px] bg-brand-soft text-brand"
              >
                <ImageDown :size="24" :stroke-width="1.7" />
              </div>
              <p class="text-[15px] font-semibold text-ink">拖拽图片到这里</p>
              <p class="mt-1 text-[12.5px] leading-relaxed text-ink-3">
                点击图片任意位置取色，同时自动提取图片主色
              </p>
              <span
                class="mt-4 inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-brand-gradient px-4 text-[12.5px] font-semibold text-white shadow-[0_10px_20px_-12px_rgba(99,102,241,0.8)]"
              >
                <Upload :size="15" />
                {{ picking ? "读取中…" : "选择图片" }}
              </span>
            </div>
          </div>
        </div>
      </section>

      <aside class="rounded-2xl border border-line bg-surface p-5 shadow-card">
        <h3 class="text-sm font-semibold">怎么用</h3>
        <ol class="mt-3.5 flex flex-col gap-3.5">
          <li v-for="(step, index) in STEPS" :key="step.title" class="flex gap-2.5">
            <span
              class="grid size-6 shrink-0 place-items-center rounded-md bg-brand-soft text-[11px] font-bold text-brand"
            >
              {{ index + 1 }}
            </span>
            <div class="min-w-0">
              <p class="text-[12px] font-medium text-ink-2">{{ step.title }}</p>
              <p class="mt-0.5 text-[11px] leading-relaxed text-ink-3">{{ step.desc }}</p>
            </div>
          </li>
        </ol>
        <div
          class="mt-4 rounded-lg bg-success-soft px-3 py-2 text-[11px] leading-relaxed text-success"
        >
          图片只在本地解析，不会上传到任何服务器
        </div>
      </aside>
    </div>

    <div
      v-else
      class="grid grid-cols-[minmax(0,1fr)_320px] items-start gap-4 max-[900px]:grid-cols-1"
    >
      <section class="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
        <header class="flex items-center justify-between gap-3 border-line px-5 py-4">
          <div class="min-w-0">
            <h2 class="truncate text-sm font-semibold">{{ imageName }}</h2>
            <p class="mt-0.5 text-[11px] text-ink-3 tabular-nums">{{ imageSize }}</p>
          </div>
          <div class="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              class="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 text-[11.5px] font-medium text-ink-2 transition-colors hover:border-line-strong hover:text-brand disabled:opacity-50"
              :disabled="picking"
              @click="pick"
            >
              <Upload :size="13" />
              {{ picking ? "读取中…" : "更换" }}
            </button>
            <button
              type="button"
              class="grid size-8 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-surface-3 hover:text-danger"
              title="移除图片"
              @click="reset"
            >
              <Trash2 :size="14" />
            </button>
          </div>
        </header>

        <div class="px-5 pt-4 pb-5">
          <div class="flex justify-center rounded-xl border border-line bg-surface-2 p-2">
            <div
              class="relative inline-block"
              @mousemove="onMove"
              @mouseleave="onLeave"
              @click="pickAt"
            >
              <canvas
                ref="canvasRef"
                class="block h-auto max-h-[520px] w-auto max-w-full cursor-crosshair rounded-lg"
                aria-label="图片取色画布"
              />
              <div
                v-if="hover"
                class="pointer-events-none absolute z-10 flex items-center gap-1.5 rounded-lg bg-[#101428]/90 px-2 py-1 shadow-lg backdrop-blur-sm"
                :style="tooltipStyle"
              >
                <span
                  class="size-3.5 shrink-0 rounded-sm border border-white/30"
                  :style="{ backgroundColor: hover.hex }"
                />
                <span class="font-mono text-[11px] font-semibold text-white">
                  {{ hover.hex }}
                </span>
              </div>
              <div
                v-if="dragActive"
                class="absolute inset-0 grid place-items-center rounded-lg bg-surface/80 backdrop-blur-sm"
              >
                <div class="text-center">
                  <ImageDown :size="26" class="mx-auto mb-1.5 text-brand" :stroke-width="1.7" />
                  <p class="text-[12.5px] font-semibold text-ink">松开鼠标替换图片</p>
                </div>
              </div>
            </div>
          </div>

          <div class="mt-3 flex items-center justify-between gap-3">
            <p class="text-[11.5px] text-ink-3">悬停取色，点击复制；颜色会自动加入最近使用</p>
            <button
              type="button"
              class="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-brand-soft px-3 text-[11.5px] font-semibold text-brand transition-colors hover:bg-brand-soft-2 disabled:opacity-40"
              :disabled="!currentColor"
              @click="openInLab"
            >
              <Pipette :size="13" />
              在调色盘中编辑
            </button>
          </div>
        </div>
      </section>

      <div class="flex flex-col gap-4">
        <section class="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
          <header class="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
            <h2 class="text-sm font-semibold">图片主色</h2>
            <span class="text-[11px] text-ink-3">{{ palette.length }} 种</span>
          </header>
          <div class="grid grid-cols-4 gap-2 px-5 pt-4 pb-5">
            <button
              v-for="color in palette"
              :key="color"
              type="button"
              class="relative h-16 overflow-hidden rounded-lg border border-black/5 transition-transform hover:scale-[1.04]"
              :style="{ backgroundColor: color }"
              :title="`复制 ${color.toUpperCase()}`"
              @click="copyColor(color)"
            >
              <span
                class="absolute inset-x-0 bottom-1 text-[9.5px] font-semibold tabular-nums"
                :style="{ color: readableTextColor(color) }"
              >
                {{ color.toUpperCase() }}
              </span>
            </button>
          </div>
        </section>

        <section class="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
          <header class="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
            <h2 class="text-sm font-semibold">已取色</h2>
            <button
              v-if="picked.length"
              type="button"
              class="text-[11px] text-ink-3 transition-colors hover:text-danger"
              @click="clearPicked"
            >
              清空
            </button>
          </header>
          <div class="px-5 pt-4 pb-5">
            <div v-if="picked.length" class="flex flex-col gap-0.5">
              <button
                v-for="color in picked"
                :key="color"
                type="button"
                class="group flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-surface-2"
                :title="`复制 ${color}`"
                @click="copyColor(color)"
              >
                <span
                  class="size-6 shrink-0 rounded-md border border-line"
                  :style="{ backgroundColor: color }"
                />
                <span class="font-mono text-[11.5px] font-medium">{{ color }}</span>
                <Copy
                  :size="12"
                  class="ml-auto shrink-0 text-ink-3 opacity-0 transition-all group-hover:text-brand group-hover:opacity-100"
                />
              </button>
            </div>
            <p v-else class="text-[11.5px] leading-relaxed text-ink-3">
              在图片上点击取色，取到的颜色会记录在这里
            </p>
          </div>
        </section>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="dragActive"
        class="pointer-events-none fixed inset-0 z-50 grid place-items-center bg-page/85 p-6 backdrop-blur-sm"
      >
        <div
          class="flex w-full max-w-[560px] flex-col items-center rounded-3xl border-2 border-dashed border-brand bg-surface/95 px-6 py-14 text-center shadow-2xl"
        >
          <div class="mb-4 grid size-16 place-items-center rounded-2xl bg-brand-soft text-brand">
            <ImageDown :size="32" :stroke-width="1.7" />
          </div>
          <p class="text-lg font-semibold text-ink">松开鼠标，载入图片</p>
          <p class="mt-1.5 text-[13px] text-ink-3">
            整个页面均可拖拽 · 支持 PNG / JPG / WebP / GIF / BMP
          </p>
        </div>
      </div>
    </Teleport>
  </div>
</template>
