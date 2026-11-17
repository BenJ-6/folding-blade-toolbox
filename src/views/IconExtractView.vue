<script setup lang="ts">
import { computed, onUnmounted, ref } from "vue";
import {
  AppWindow,
  Copy,
  Download,
  FileImage,
  FolderDown,
  LoaderCircle,
  Upload,
  X,
} from "lucide-vue-next";
import PageHeader from "@/components/PageHeader.vue";
import { useFileDrop } from "@/composables/useFileDrop";
import { useToast } from "@/composables/useToast";
import { isTauri } from "@/lib/backend";
import { pickFile, readFileBytes, saveImage, saveMany, type PickedFile } from "@/lib/files";
import { formatBytes } from "@/lib/format";
import {
  ICON_SOURCE_EXTENSIONS,
  buildIcoBlob,
  iconAssetToPng,
  isIconSourceExtension,
  parseIconAssets,
  type IconAsset,
} from "@/lib/iconExtract";

const { message, notify } = useToast();

const file = ref<PickedFile | null>(null);
const format = ref<"pe" | "ico" | "">("");
const assets = ref<IconAsset[]>([]);
const previews = ref<Record<number, string>>({});
const failed = ref<Record<number, string>>({});
const selectedIndex = ref<number | null>(null);
const loading = ref(false);
const picking = ref(false);
const exporting = ref(false);
const error = ref("");

const blobs = new Map<number, Blob>();
let loadToken = 0;

const selected = computed(
  () => assets.value.find((asset) => asset.index === selectedIndex.value) ?? null,
);
const groupCount = computed(() => new Set(assets.value.map((asset) => asset.group)).size);
const previewCount = computed(() => Object.keys(previews.value).length);
const fileBase = computed(() => (file.value?.name ?? "icon").replace(/\.[^.]+$/, ""));
const previewUrl = computed(() =>
  selected.value ? previews.value[selected.value.index] : undefined,
);
const formatLabel = computed(() => (format.value === "ico" ? "ICO 图标文件" : "PE 可执行文件"));

function revokePreviews(): void {
  Object.values(previews.value).forEach((url) => URL.revokeObjectURL(url));
  previews.value = {};
  failed.value = {};
  blobs.clear();
}

function reset(): void {
  loadToken += 1;
  revokePreviews();
  file.value = null;
  format.value = "";
  assets.value = [];
  selectedIndex.value = null;
  loading.value = false;
}

async function loadFromPicked(picked: PickedFile): Promise<void> {
  const token = ++loadToken;
  loading.value = true;
  error.value = "";
  try {
    const bytes = await readFileBytes(picked);
    if (token !== loadToken) {
      return;
    }

    const parsed = parseIconAssets(bytes);
    revokePreviews();
    file.value = picked;
    format.value = parsed.format;
    assets.value = parsed.assets;
    selectedIndex.value = parsed.assets.length ? parsed.assets[0].index : null;

    const urls: Record<number, string> = {};
    for (const asset of parsed.assets) {
      if (token !== loadToken) {
        return;
      }
      try {
        const blob = await iconAssetToPng(asset);
        blobs.set(asset.index, blob);
        urls[asset.index] = URL.createObjectURL(blob);
      } catch (caught) {
        // 单个图标解码失败时标记出来，不影响其它图标
        failed.value[asset.index] = caught instanceof Error ? caught.message : String(caught);
      }
    }
    previews.value = urls;
  } catch (caught) {
    if (token !== loadToken) {
      return;
    }
    if (!assets.value.length) {
      reset();
    }
    error.value = caught instanceof Error ? caught.message : String(caught);
  } finally {
    if (token === loadToken) {
      loading.value = false;
    }
  }
}

function loadPath(path: string): void {
  void loadFromPicked({ path, name: path.split(/[\\/]/).pop() ?? path });
}

const { dragActive } = useFileDrop({
  onPaths: (paths) => {
    const target = paths.find((path) => isIconSourceExtension(path));
    if (target) {
      loadPath(target);
    }
  },
  onFiles: (files) => {
    if (isTauri()) {
      return;
    }
    const target = files.find((item) => isIconSourceExtension(item.name));
    if (target) {
      void loadFromPicked({ file: target, name: target.name });
    }
  },
});

async function handlePick(): Promise<void> {
  if (picking.value) {
    return;
  }
  picking.value = true;
  try {
    const picked = await pickFile([...ICON_SOURCE_EXTENSIONS], "EXE / DLL / ICO");
    if (picked) {
      await loadFromPicked(picked);
    }
  } catch (caught) {
    notify(caught instanceof Error ? caught.message : "读取文件失败");
  } finally {
    picking.value = false;
  }
}

function select(index: number): void {
  selectedIndex.value = index;
}

async function savePng(): Promise<void> {
  const asset = selected.value;
  const blob = asset ? blobs.get(asset.index) : undefined;
  if (!asset || !blob) {
    notify("该图标尚未解码完成");
    return;
  }
  try {
    const saved = await saveImage(blob, `${fileBase.value}-${asset.width}x${asset.height}.png`);
    if (saved) {
      notify("已保存 PNG");
    }
  } catch (caught) {
    notify(caught instanceof Error ? caught.message : "保存失败");
  }
}

async function copyPng(): Promise<void> {
  const asset = selected.value;
  const blob = asset ? blobs.get(asset.index) : undefined;
  if (!blob) {
    return;
  }
  try {
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    notify("已复制图标到剪贴板");
  } catch {
    notify("当前环境不支持复制图片");
  }
}

async function exportIco(groupOnly: boolean): Promise<void> {
  if (exporting.value) {
    return;
  }
  const group = selected.value?.group ?? 0;
  const list = groupOnly ? assets.value.filter((asset) => asset.group === group) : assets.value;
  if (!list.length) {
    return;
  }

  exporting.value = true;
  try {
    const suffix = groupOnly && groupCount.value > 1 ? `-${group + 1}` : "";
    const saved = await saveImage(buildIcoBlob(list), `${fileBase.value}${suffix}.ico`);
    if (saved) {
      notify(`已导出 ${list.length} 个尺寸的 ICO`);
    }
  } catch (caught) {
    notify(caught instanceof Error ? caught.message : "导出失败");
  } finally {
    exporting.value = false;
  }
}

async function exportAllPng(): Promise<void> {
  const counts = new Map<string, number>();
  assets.value.forEach((asset) => {
    const key = `${asset.width}x${asset.height}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });

  const items = assets.value
    .map((asset) => ({ asset, blob: blobs.get(asset.index) }))
    .filter((entry): entry is { asset: IconAsset; blob: Blob } => Boolean(entry.blob))
    .map(({ asset, blob }) => {
      const key = `${asset.width}x${asset.height}`;
      const duplicate = (counts.get(key) ?? 0) > 1 ? `-${asset.index + 1}` : "";
      return { blob, fileName: `${fileBase.value}-${key}${duplicate}.png` };
    });

  if (!items.length) {
    notify("没有可导出的图标");
    return;
  }

  try {
    const count = await saveMany(items);
    if (count > 0) {
      notify(`已导出 ${count} 个 PNG`);
    }
  } catch (caught) {
    notify(caught instanceof Error ? caught.message : "导出失败");
  }
}

onUnmounted(() => {
  loadToken += 1;
  revokePreviews();
});
</script>

<template>
  <section class="mx-auto w-full max-w-[1180px]">
    <PageHeader
      title="图标提取"
      description="从 EXE / DLL / ICO 文件中提取内嵌图标，导出 PNG 或完整 ICO"
    />

    <div class="grid grid-cols-[minmax(0,1fr)_336px] items-start gap-5 max-[980px]:grid-cols-1">
      <div class="flex min-w-0 flex-col gap-4">
        <div
          v-if="!assets.length"
          role="button"
          tabindex="0"
          class="cursor-pointer rounded-2xl border-[1.5px] border-dashed px-6 py-10 text-center transition-colors"
          :class="
            dragActive
              ? 'border-brand bg-brand-soft'
              : 'border-line-strong bg-surface/80 hover:border-brand-soft-2 hover:bg-surface'
          "
          @click="handlePick"
          @keydown.enter.prevent="handlePick"
        >
          <div class="mx-auto flex max-w-[380px] flex-col items-center">
            <div
              class="mb-3.5 grid size-12 place-items-center rounded-[14px] bg-brand-soft text-brand"
            >
              <LoaderCircle v-if="loading || picking" :size="24" class="animate-spin" />
              <AppWindow v-else :size="24" :stroke-width="1.7" />
            </div>
            <p class="text-[15px] font-semibold text-ink">
              {{ loading ? "正在解析图标…" : "拖拽 EXE / DLL / ICO 到这里" }}
            </p>
            <p class="mt-1 text-[12.5px] text-ink-3">
              读取 PE 资源段中的全部图标，支持多尺寸与透明通道
            </p>
            <span
              class="mt-4 inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-brand-gradient px-4 text-[12.5px] font-semibold text-white shadow-[0_10px_20px_-12px_rgba(99,102,241,0.8)]"
            >
              <Upload :size="15" />
              {{ picking ? "读取中…" : "选择文件" }}
            </span>
          </div>
        </div>

        <template v-else>
          <div
            class="flex items-center gap-3 rounded-[14px] border border-line bg-surface px-4 py-3 shadow-card"
          >
            <span
              class="grid size-9 shrink-0 place-items-center rounded-[10px] bg-brand-soft text-brand"
            >
              <AppWindow :size="18" />
            </span>
            <div class="min-w-0 flex-1">
              <p class="truncate text-[13px] font-medium text-ink">{{ file?.name }}</p>
              <p class="text-[11.5px] text-ink-3">
                {{ formatLabel }} · 共 {{ assets.length }} 个图标<span v-if="groupCount > 1">
                  · {{ groupCount }} 组</span
                >
              </p>
            </div>
            <button
              type="button"
              class="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-line bg-surface px-2.5 text-[12px] font-medium text-ink-2 transition-colors hover:border-line-strong hover:text-ink disabled:opacity-60"
              :disabled="picking || loading"
              @click="handlePick"
            >
              <LoaderCircle v-if="loading" :size="14" class="animate-spin" />
              <Upload v-else :size="14" />
              更换
            </button>
          </div>

          <section class="rounded-2xl border border-line bg-surface p-4 shadow-card">
            <header class="mb-3 flex items-center justify-between gap-3">
              <h2 class="text-[13px] font-semibold text-ink">图标列表</h2>
              <span class="text-[11.5px] text-ink-3">点击图标查看并导出</span>
            </header>
            <div class="grid grid-cols-[repeat(auto-fill,minmax(92px,1fr))] gap-2.5">
              <button
                v-for="asset in assets"
                :key="asset.index"
                type="button"
                class="flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 transition-colors"
                :class="
                  selectedIndex === asset.index
                    ? 'border-brand bg-brand-soft'
                    : 'border-line bg-surface hover:border-line-strong hover:bg-surface-2'
                "
                @click="select(asset.index)"
              >
                <span class="grid size-14 place-items-center rounded-lg bg-checkerboard">
                  <img
                    v-if="previews[asset.index]"
                    :src="previews[asset.index]"
                    :alt="`${asset.width}×${asset.height}`"
                    class="max-h-12 max-w-12 object-contain"
                  />
                  <X
                    v-else-if="failed[asset.index]"
                    :size="16"
                    class="text-danger"
                    aria-label="解码失败"
                  />
                  <LoaderCircle v-else :size="16" class="animate-spin text-ink-3" />
                </span>
                <span class="text-[11px] font-medium text-ink-2 tabular-nums">
                  {{ asset.width }}×{{ asset.height }}
                </span>
                <span class="text-[10px] text-ink-3">
                  {{ asset.isPng ? "PNG" : `${asset.bitCount} 位` }}
                </span>
              </button>
            </div>
          </section>
        </template>

        <p
          v-if="error"
          class="rounded-xl border border-line bg-[#fdecec] px-4 py-3 text-[12px] leading-relaxed text-danger"
        >
          {{ error }}
        </p>

        <section
          v-if="!assets.length && !error"
          class="rounded-2xl border border-line bg-surface p-5 text-[12.5px] leading-relaxed text-ink-3 shadow-card"
        >
          支持 EXE、DLL、OCX、CPL 等 PE 文件与 ICO / ICL
          图标文件。会读取资源段中的图标组，按原始尺寸列出 16×16 到 256×256
          的全部图标，透明通道完整保留。解析全部在本地完成，文件不会上传。
        </section>
      </div>

      <aside
        class="sticky top-5 overflow-hidden rounded-2xl border border-line bg-surface shadow-card max-[980px]:static max-[980px]:order-first"
      >
        <header class="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 class="flex items-center gap-2 text-sm font-semibold">
            <FileImage :size="17" class="text-brand" />
            图标预览
          </h2>
          <div class="flex items-center gap-2">
            <span
              v-if="selected"
              class="rounded-md bg-brand-soft px-2 py-0.5 text-[11px] font-semibold text-brand"
            >
              {{ selected.isPng ? "PNG" : `${selected.bitCount} 位` }}
            </span>
            <button
              v-if="assets.length"
              type="button"
              class="grid size-6 place-items-center rounded-md text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink-2"
              title="关闭文件"
              @click="reset"
            >
              <X :size="14" />
            </button>
          </div>
        </header>

        <div class="flex flex-col gap-4 px-5 pt-4 pb-5">
          <template v-if="selected">
            <div class="grid place-items-center rounded-xl border border-line bg-checkerboard p-4">
              <img
                v-if="previewUrl"
                :src="previewUrl"
                :alt="`${selected.width}×${selected.height}`"
                class="max-h-[132px] max-w-[132px] object-contain"
              />
              <p v-else-if="failed[selected.index]" class="text-[11.5px] text-danger">
                {{ failed[selected.index] }}
              </p>
              <LoaderCircle v-else :size="20" class="animate-spin text-ink-3" />
            </div>

            <div class="flex flex-col gap-2.5">
              <div class="flex items-start justify-between gap-3 border-b border-line pb-2">
                <span class="shrink-0 text-[11.5px] text-ink-3">尺寸</span>
                <span class="text-[11.5px] font-medium text-ink-2 tabular-nums">
                  {{ selected.width }} × {{ selected.height }}
                </span>
              </div>
              <div class="flex items-start justify-between gap-3 border-b border-line pb-2">
                <span class="shrink-0 text-[11.5px] text-ink-3">色深</span>
                <span class="text-[11.5px] font-medium text-ink-2">
                  {{ selected.bitCount }} 位
                </span>
              </div>
              <div class="flex items-start justify-between gap-3 border-b border-line pb-2">
                <span class="shrink-0 text-[11.5px] text-ink-3">编码</span>
                <span class="text-[11.5px] font-medium text-ink-2">
                  {{ selected.isPng ? "PNG 压缩" : "位图（DIB）" }}
                </span>
              </div>
              <div class="flex items-start justify-between gap-3 border-b border-line pb-2">
                <span class="shrink-0 text-[11.5px] text-ink-3">数据大小</span>
                <span class="text-[11.5px] font-medium text-ink-2">
                  {{ formatBytes(selected.bytes) }}
                </span>
              </div>
              <div class="flex items-start justify-between gap-3">
                <span class="shrink-0 text-[11.5px] text-ink-3">图标组</span>
                <span class="text-[11.5px] font-medium text-ink-2">
                  第 {{ selected.group + 1 }} 组 · 第 {{ selected.index + 1 }} 个
                </span>
              </div>
            </div>

            <div class="flex flex-col gap-2">
              <button
                type="button"
                class="inline-flex h-9 items-center justify-center gap-1.5 rounded-[9px] bg-brand-gradient text-[12px] font-semibold text-white shadow-[0_10px_20px_-12px_rgba(99,102,241,0.8)] disabled:opacity-60"
                :disabled="!previewUrl"
                @click="savePng"
              >
                <Download :size="14" />
                保存为 PNG
              </button>
              <button
                type="button"
                class="inline-flex h-9 items-center justify-center gap-1.5 rounded-[9px] border border-line bg-surface text-[12px] font-medium text-ink-2 transition-colors hover:border-line-strong hover:text-ink disabled:opacity-60"
                :disabled="!previewUrl"
                @click="copyPng"
              >
                <Copy :size="14" />
                复制到剪贴板
              </button>
              <button
                type="button"
                class="inline-flex h-9 items-center justify-center gap-1.5 rounded-[9px] border border-line bg-surface text-[12px] font-medium text-ink-2 transition-colors hover:border-line-strong hover:text-ink disabled:opacity-60"
                :disabled="exporting"
                @click="exportIco(true)"
              >
                <FolderDown :size="14" />
                {{ groupCount > 1 ? "导出该组 ICO" : "导出 ICO" }}
              </button>
              <button
                v-if="groupCount > 1"
                type="button"
                class="inline-flex h-9 items-center justify-center gap-1.5 rounded-[9px] border border-line bg-surface text-[12px] font-medium text-ink-2 transition-colors hover:border-line-strong hover:text-ink disabled:opacity-60"
                :disabled="exporting"
                @click="exportIco(false)"
              >
                <FolderDown :size="14" />
                导出全部 ICO
              </button>
              <button
                type="button"
                class="inline-flex h-9 items-center justify-center gap-1.5 rounded-[9px] border border-line bg-surface text-[12px] font-medium text-ink-2 transition-colors hover:border-line-strong hover:text-ink disabled:opacity-60"
                :disabled="!previewCount"
                @click="exportAllPng"
              >
                <Download :size="14" />
                导出全部 PNG
              </button>
            </div>

            <p class="text-[11px] leading-relaxed text-ink-3">
              导出的 ICO 会保留原始尺寸集合与透明通道，可直接用于 Windows 快捷方式或网站 favicon。
            </p>
          </template>

          <p v-else class="py-6 text-center text-[12px] leading-relaxed text-ink-3">
            选择左侧文件后<br />在这里预览并导出图标
          </p>
        </div>
      </aside>
    </div>

    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-150 ease-out"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="message"
          class="pointer-events-none fixed bottom-8 left-1/2 z-50 -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-[12.5px] font-medium text-white shadow-lg"
        >
          {{ message }}
        </div>
      </Transition>

      <div
        v-if="dragActive"
        class="pointer-events-none fixed inset-0 z-50 grid place-items-center bg-page/85 p-6 backdrop-blur-sm"
      >
        <div
          class="flex w-full max-w-[560px] flex-col items-center rounded-3xl border-2 border-dashed border-brand bg-surface/95 px-6 py-14 text-center shadow-2xl"
        >
          <div class="mb-4 grid size-16 place-items-center rounded-2xl bg-brand-soft text-brand">
            <Upload :size="32" :stroke-width="1.7" />
          </div>
          <p class="text-lg font-semibold text-ink">松开鼠标，读取图标</p>
          <p class="mt-1.5 text-[13px] text-ink-3">支持 EXE / DLL / OCX / CPL / ICO / ICL</p>
        </div>
      </div>
    </Teleport>
  </section>
</template>
