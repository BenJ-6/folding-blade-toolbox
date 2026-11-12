<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { Droplets, ImagePlus, LoaderCircle, RotateCcw, Stamp, Trash2, Zap } from "lucide-vue-next";
import ComparePreview from "@/components/ComparePreview.vue";
import DropZone from "@/components/DropZone.vue";
import PageHeader from "@/components/PageHeader.vue";
import TaskFileList from "@/components/TaskFileList.vue";
import { useFileDrop } from "@/composables/useFileDrop";
import { createImageTaskQueue } from "@/composables/imageTaskQueue";
import { useToast } from "@/composables/useToast";
import { guessMime, readImageFile, saveImage, saveMany } from "@/lib/files";
import { applyWatermark, watermarkFileName, type WatermarkPosition } from "@/lib/watermark";

const { notify } = useToast();
const queue = createImageTaskQueue();

const { items, selectedId, selectedItem, picking, processing, progress } = queue;

const options = reactive({
  text: "折刀雀工具箱",
  fontSize: 5,
  color: "#FFFFFF",
  opacity: 70,
  rotate: -20,
  position: "bottom-right" as WatermarkPosition,
  logoDataUrl: "",
  logoScale: 16,
  quality: 92,
});

const mode = ref<"text" | "logo">("text");
const logoName = ref("");
const logoInput = ref<HTMLInputElement | null>(null);

const positions: { value: WatermarkPosition; label: string }[] = [
  { value: "top-left", label: "左上" },
  { value: "top", label: "上" },
  { value: "top-right", label: "右上" },
  { value: "left", label: "左" },
  { value: "center", label: "居中" },
  { value: "right", label: "右" },
  { value: "bottom-left", label: "左下" },
  { value: "bottom", label: "下" },
  { value: "bottom-right", label: "右下" },
];

const opacityFill = computed<Record<string, string>>(() => ({
  "--fill": `${options.opacity}%`,
}));

const fontFill = computed<Record<string, string>>(() => ({
  "--fill": `${((options.fontSize - 2) / 13) * 100}%`,
}));

const rotateFill = computed<Record<string, string>>(() => ({
  "--fill": `${((options.rotate + 45) / 90) * 100}%`,
}));

const previewItem = computed(() => (selectedItem.value?.result ? selectedItem.value : null));

const canProcess = computed(
  () =>
    items.value.length > 0 &&
    (mode.value === "logo" ? Boolean(options.logoDataUrl) : Boolean(options.text.trim())),
);

watch(
  options,
  () => {
    if (items.value.some((item) => item.result)) {
      queue.markStale();
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

function pickLogo(): void {
  logoInput.value?.click();
}

function onLogoChange(event: Event): void {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) {
    return;
  }
  if (!file.type.startsWith("image/")) {
    notify("请选择图片文件");
    return;
  }
  if (file.size > 2 * 1024 * 1024) {
    notify("Logo 请控制在 2MB 以内");
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    options.logoDataUrl = String(reader.result ?? "");
    logoName.value = file.name;
    mode.value = "logo";
    notify("Logo 已添加");
  };
  reader.readAsDataURL(file);
}

function removeLogo(): void {
  options.logoDataUrl = "";
  logoName.value = "";
}

function resetOptions(): void {
  Object.assign(options, {
    text: "折刀雀工具箱",
    fontSize: 5,
    color: "#FFFFFF",
    opacity: 70,
    rotate: -20,
    position: "bottom-right" as WatermarkPosition,
    logoDataUrl: "",
    logoScale: 16,
    quality: 92,
  });
  logoName.value = "";
}

async function processAll(): Promise<void> {
  await queue.processAll(async (item) => {
    const blob = item.blob ?? (await readImageFile(item));
    const sourceMime = guessMime(item.name);
    const output = await applyWatermark(blob, sourceMime, {
      ...options,
      logoDataUrl: mode.value === "logo" ? options.logoDataUrl : "",
    });
    const mime = output.type || sourceMime;
    return { blob: output, mime, fileName: watermarkFileName(item.name, mime) };
  });
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
      title="批量加水印"
      description="给图片批量添加文字或 Logo 水印，位置、大小、透明度自由调整"
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
          :busy="processing"
          empty-hint="添加图片后开始批量加水印"
          @select="handleSelect"
          @remove="queue.remove"
          @clear="queue.clear"
          @add="handlePick"
          @download="handleDownload"
          @download-all="handleDownloadAll"
        />
        <ComparePreview :item="previewItem" />
      </div>

      <aside
        class="sticky top-5 overflow-hidden rounded-2xl border border-line bg-surface shadow-card max-[980px]:static max-[980px]:order-first"
      >
        <header class="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 class="flex items-center gap-2 text-sm font-semibold">
            <Droplets :size="17" class="text-brand" />
            水印设置
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
          <div class="flex flex-col gap-2">
            <p class="text-[12.5px] font-semibold text-ink-2">水印内容</p>
            <div class="flex items-center gap-1 rounded-lg bg-surface-2 p-1">
              <button
                type="button"
                class="inline-flex h-7 flex-1 items-center justify-center gap-1 rounded-md text-[11.5px] transition-colors"
                :class="
                  mode === 'text'
                    ? 'bg-surface font-semibold text-brand shadow-card'
                    : 'font-medium text-ink-2 hover:text-ink'
                "
                @click="mode = 'text'"
              >
                <Stamp :size="13" />
                文字
              </button>
              <button
                type="button"
                class="inline-flex h-7 flex-1 items-center justify-center gap-1 rounded-md text-[11.5px] transition-colors"
                :class="
                  mode === 'logo'
                    ? 'bg-surface font-semibold text-brand shadow-card'
                    : 'font-medium text-ink-2 hover:text-ink'
                "
                @click="mode = 'logo'"
              >
                <ImagePlus :size="13" />
                Logo
              </button>
            </div>
          </div>

          <template v-if="mode === 'text'">
            <div class="flex flex-col gap-1.5">
              <p class="text-[12px] font-medium text-ink-2">文字内容</p>
              <input
                v-model="options.text"
                type="text"
                class="field"
                placeholder="例如 折刀雀工具箱"
              />
            </div>

            <div class="flex flex-col gap-2">
              <div class="flex items-center justify-between">
                <p class="text-[12.5px] font-semibold text-ink-2">字号</p>
                <span
                  class="rounded-md bg-brand-soft px-2 py-0.5 text-[11.5px] font-semibold text-brand"
                >
                  {{ options.fontSize }}%
                </span>
              </div>
              <input
                v-model.number="options.fontSize"
                type="range"
                min="2"
                max="15"
                step="0.5"
                class="range-slider"
                :style="fontFill"
              />
              <p class="text-[11.5px] leading-relaxed text-ink-3">相对图片短边的比例</p>
            </div>

            <div class="flex flex-col gap-1.5">
              <p class="text-[12px] font-medium text-ink-2">颜色</p>
              <div class="flex items-center gap-2">
                <input
                  v-model="options.color"
                  type="color"
                  class="size-8 shrink-0 cursor-pointer rounded-lg border border-line bg-transparent p-0.5"
                  aria-label="水印颜色"
                />
                <input v-model="options.color" type="text" class="field font-mono uppercase" />
              </div>
            </div>
          </template>

          <template v-else>
            <input
              ref="logoInput"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              class="hidden"
              @change="onLogoChange"
            />
            <div class="flex flex-col gap-2">
              <p class="text-[12.5px] font-semibold text-ink-2">Logo 图片</p>
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  class="inline-flex h-9 items-center gap-1.5 rounded-[9px] border border-dashed border-line-strong bg-surface-2 px-3 text-[12px] font-medium text-ink-2 transition-colors hover:border-brand hover:text-brand"
                  @click="pickLogo"
                >
                  <ImagePlus :size="15" />
                  {{ options.logoDataUrl ? "更换 Logo" : "上传 Logo" }}
                </button>
                <template v-if="options.logoDataUrl">
                  <img
                    :src="options.logoDataUrl"
                    :alt="logoName"
                    class="size-9 rounded-md border border-line bg-white object-contain p-0.5"
                  />
                  <button
                    type="button"
                    class="grid size-8 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-surface-3 hover:text-danger"
                    title="移除 Logo"
                    @click="removeLogo"
                  >
                    <Trash2 :size="15" />
                  </button>
                </template>
              </div>
              <p class="text-[11px] leading-relaxed text-ink-3">建议使用透明背景的 PNG</p>
            </div>

            <div class="flex flex-col gap-2">
              <div class="flex items-center justify-between">
                <p class="text-[12.5px] font-semibold text-ink-2">Logo 宽度</p>
                <span
                  class="rounded-md bg-brand-soft px-2 py-0.5 text-[11.5px] font-semibold text-brand"
                >
                  {{ options.logoScale }}%
                </span>
              </div>
              <input
                v-model.number="options.logoScale"
                type="range"
                min="4"
                max="60"
                step="1"
                class="range-slider"
                :style="{ '--fill': `${((options.logoScale - 4) / 56) * 100}%` }"
              />
            </div>
          </template>

          <div class="flex flex-col gap-2">
            <p class="text-[12.5px] font-semibold text-ink-2">位置</p>
            <div class="grid grid-cols-3 gap-1.5">
              <button
                v-for="position in positions"
                :key="position.value"
                type="button"
                class="h-8 rounded-lg border text-[11.5px] font-medium transition-colors"
                :class="
                  options.position === position.value
                    ? 'border-brand bg-brand-soft font-semibold text-brand'
                    : 'border-line bg-surface text-ink-2 hover:border-line-strong'
                "
                @click="options.position = position.value"
              >
                {{ position.label }}
              </button>
            </div>
            <button
              type="button"
              class="h-8 rounded-lg border text-[11.5px] font-medium transition-colors"
              :class="
                options.position === 'tile'
                  ? 'border-brand bg-brand-soft font-semibold text-brand'
                  : 'border-line bg-surface text-ink-2 hover:border-line-strong'
              "
              @click="options.position = 'tile'"
            >
              平铺整个画面
            </button>
          </div>

          <div class="flex flex-col gap-2">
            <div class="flex items-center justify-between">
              <p class="text-[12.5px] font-semibold text-ink-2">不透明度</p>
              <span
                class="rounded-md bg-brand-soft px-2 py-0.5 text-[11.5px] font-semibold text-brand"
              >
                {{ options.opacity }}%
              </span>
            </div>
            <input
              v-model.number="options.opacity"
              type="range"
              min="5"
              max="100"
              step="5"
              class="range-slider"
              :style="opacityFill"
            />
          </div>

          <div class="flex flex-col gap-2">
            <div class="flex items-center justify-between">
              <p class="text-[12.5px] font-semibold text-ink-2">旋转</p>
              <span
                class="rounded-md bg-brand-soft px-2 py-0.5 text-[11.5px] font-semibold text-brand"
              >
                {{ options.rotate }}°
              </span>
            </div>
            <input
              v-model.number="options.rotate"
              type="range"
              min="-45"
              max="45"
              step="1"
              class="range-slider"
              :style="rotateFill"
            />
          </div>

          <div class="flex flex-col gap-2">
            <div class="flex items-center justify-between">
              <p class="text-[12.5px] font-semibold text-ink-2">JPG 输出质量</p>
              <span class="text-[11.5px] text-ink-3">{{ options.quality }}</span>
            </div>
            <input
              v-model.number="options.quality"
              type="range"
              min="60"
              max="100"
              step="1"
              class="range-slider"
              :style="{ '--fill': `${((options.quality - 60) / 40) * 100}%` }"
            />
            <p class="text-[11.5px] leading-relaxed text-ink-3">PNG 输入会输出 PNG</p>
          </div>
        </div>

        <div class="mt-4 flex flex-col gap-2 border-t border-line px-5 py-5">
          <button
            type="button"
            class="inline-flex h-[42px] items-center justify-center gap-2 rounded-[10px] bg-brand-gradient text-[13.5px] font-semibold text-white transition-all hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="!canProcess || processing"
            @click="processAll"
          >
            <LoaderCircle v-if="processing" :size="17" class="animate-spin" />
            <Zap v-else :size="17" />
            {{
              processing
                ? `处理中 ${progress.done}/${progress.total}`
                : `开始加水印${items.length ? `（${items.length} 张）` : ""}`
            }}
          </button>
          <div
            v-if="processing"
            class="flex items-center justify-center gap-2 text-[11.5px] text-ink-3"
          >
            <span>正在处理，请稍候</span>
            <button
              type="button"
              class="text-danger hover:underline"
              @click="queue.cancelProcessing"
            >
              取消
            </button>
          </div>
          <p v-else-if="!items.length" class="text-center text-[11.5px] text-ink-3">
            先添加图片，再调整水印样式
          </p>
        </div>
      </aside>
    </div>
  </section>
</template>
