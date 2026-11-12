<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  CheckCircle2,
  ClipboardPaste,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  ImageUp,
  Info,
  LoaderCircle,
  ScanLine,
  TriangleAlert,
  X,
} from "lucide-vue-next";
import { useFileDrop } from "@/composables/useFileDrop";
import { isTauri } from "@/lib/backend";
import { copyText } from "@/lib/clipboard";
import { pickImages, readImageFile, type PickedFile } from "@/lib/files";
import { decodeQrImage, QR_IMAGE_EXTENSIONS, type QrDecodeResult } from "@/lib/qr";

type ScanState = "idle" | "working" | "success" | "error";

const state = ref<ScanState>("idle");
const previewUrl = ref("");
const fileName = ref("");
const result = ref<QrDecodeResult | null>(null);
const errorMessage = ref("");
const picking = ref(false);
const copied = ref(false);
const showPassword = ref(false);
const notice = ref("");

let scanToken = 0;
let copyTimer: number | undefined;
let noticeTimer: number | undefined;

const busy = computed(() => state.value === "working");

const resultUrl = computed(() => result.value?.info.url ?? "");
const wifiInfo = computed(() => result.value?.info.wifi ?? null);

const maskedPassword = computed(() => {
  const password = wifiInfo.value?.password ?? "";
  if (!password) {
    return "无密码";
  }
  if (showPassword.value) {
    return password;
  }
  return "•".repeat(Math.min(password.length, 16));
});

const vcardRows = computed(() => {
  const info = result.value?.info.vcard;
  if (!info) {
    return [];
  }
  const rows: { label: string; value: string }[] = [];
  if (info.name) {
    rows.push({ label: "姓名", value: info.name });
  }
  if (info.org) {
    rows.push({ label: "公司", value: info.org });
  }
  if (info.tel) {
    rows.push({ label: "电话", value: info.tel });
  }
  if (info.email) {
    rows.push({ label: "邮箱", value: info.email });
  }
  if (info.url) {
    rows.push({ label: "网址", value: info.url });
  }
  return rows;
});

const stateText = computed(() => {
  if (state.value === "working") {
    return "正在识别…";
  }
  if (state.value === "success") {
    return "识别完成";
  }
  if (state.value === "error") {
    return "未识别到二维码";
  }
  return "";
});

function showNotice(message: string): void {
  notice.value = message;
  window.clearTimeout(noticeTimer);
  noticeTimer = window.setTimeout(() => {
    notice.value = "";
  }, 2200);
}

function releasePreview(): void {
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value);
    previewUrl.value = "";
  }
}

function reset(): void {
  scanToken += 1;
  releasePreview();
  state.value = "idle";
  result.value = null;
  errorMessage.value = "";
  fileName.value = "";
  copied.value = false;
  showPassword.value = false;
}

async function scanBlob(blob: Blob, name: string): Promise<void> {
  const token = (scanToken += 1);
  releasePreview();
  previewUrl.value = URL.createObjectURL(blob);
  fileName.value = name;
  result.value = null;
  errorMessage.value = "";
  copied.value = false;
  showPassword.value = false;
  state.value = "working";

  try {
    const decoded = await decodeQrImage(blob);
    if (token !== scanToken) {
      return;
    }
    if (!decoded) {
      state.value = "error";
      errorMessage.value = "图片里没有找到可识别的二维码，换一张更清晰的图片试试。";
      return;
    }
    result.value = decoded;
    state.value = "success";
  } catch (error) {
    if (token !== scanToken) {
      return;
    }
    state.value = "error";
    errorMessage.value = error instanceof Error ? error.message : "图片解析失败，请换一张试试";
  }
}

async function scanPicked(picked: PickedFile): Promise<void> {
  try {
    const blob = await readImageFile(picked);
    await scanBlob(blob, picked.name);
  } catch {
    state.value = "error";
    errorMessage.value = "无法读取这张图片，请确认文件没有被移动或损坏";
  }
}

async function pick(): Promise<void> {
  if (picking.value || busy.value) {
    return;
  }
  picking.value = true;
  try {
    const picked = await pickImages(QR_IMAGE_EXTENSIONS);
    if (picked[0]) {
      await scanPicked(picked[0]);
    }
  } finally {
    picking.value = false;
  }
}

async function pasteFromClipboard(): Promise<void> {
  if (busy.value) {
    return;
  }
  try {
    const items = await navigator.clipboard.read();
    for (const item of items) {
      const type = item.types.find((entry) => entry.startsWith("image/"));
      if (type) {
        const blob = await item.getType(type);
        await scanBlob(blob, "剪贴板图片");
        return;
      }
    }
    showNotice("剪贴板里没有图片");
  } catch {
    showNotice("无法读取剪贴板，请改用 Ctrl+V 或选择图片");
  }
}

function handlePaste(event: ClipboardEvent): void {
  const items = Array.from(event.clipboardData?.items ?? []);
  const imageItem = items.find((item) => item.type.startsWith("image/"));
  const file = imageItem?.getAsFile();
  if (file) {
    event.preventDefault();
    void scanBlob(file, "剪贴板图片");
  }
}

const { dragActive } = useFileDrop({
  onPaths: (paths) => {
    const path = paths[0];
    if (path) {
      void scanPicked({ path, name: path.split(/[\\/]/).pop() ?? path });
    }
  },
  onFiles: (files) => {
    const file = files[0];
    if (file) {
      void scanBlob(file, file.name);
    }
  },
});

async function copyResult(): Promise<void> {
  if (!result.value) {
    return;
  }
  const ok = await copyText(result.value.text);
  if (!ok) {
    showNotice("复制失败，请手动选择内容");
    return;
  }
  copied.value = true;
  window.clearTimeout(copyTimer);
  copyTimer = window.setTimeout(() => {
    copied.value = false;
  }, 2000);
}

async function copyPassword(): Promise<void> {
  const password = wifiInfo.value?.password ?? "";
  if (!password) {
    return;
  }
  const ok = await copyText(password);
  showNotice(ok ? "密码已复制" : "复制失败");
}

async function openExternal(target: string): Promise<void> {
  try {
    if (isTauri()) {
      await openUrl(target);
    } else {
      window.open(target, "_blank", "noopener,noreferrer");
    }
  } catch {
    showNotice("打开失败，请复制内容后手动访问");
  }
}

onMounted(() => {
  window.addEventListener("paste", handlePaste);
});

onUnmounted(() => {
  window.removeEventListener("paste", handlePaste);
  window.clearTimeout(copyTimer);
  window.clearTimeout(noticeTimer);
  scanToken += 1;
  releasePreview();
});
</script>

<template>
  <div class="grid grid-cols-[minmax(0,1fr)_336px] items-start gap-5 max-[980px]:grid-cols-1">
    <div class="flex min-w-0 flex-col gap-4">
      <section class="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
        <header class="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 class="flex items-center gap-2 text-sm font-semibold">
            <ScanLine :size="17" class="text-brand" />
            识别二维码
          </h2>
          <span
            v-if="state === 'success'"
            class="rounded-md bg-success-soft px-2 py-0.5 text-[11px] font-semibold text-success"
          >
            已识别
          </span>
        </header>

        <div class="flex flex-col gap-4 px-5 pt-4 pb-5">
          <div
            v-if="state === 'idle'"
            role="button"
            tabindex="0"
            class="cursor-pointer rounded-xl border-[1.5px] border-dashed px-6 py-10 text-center transition-colors"
            :class="
              dragActive
                ? 'border-brand bg-brand-soft'
                : 'border-line-strong bg-surface/80 hover:border-brand-soft-2 hover:bg-surface'
            "
            @click="pick"
            @keydown.enter.prevent="pick"
          >
            <div
              class="mx-auto mb-3.5 grid size-12 place-items-center rounded-[14px] bg-brand-soft text-brand"
            >
              <ScanLine :size="24" :stroke-width="1.7" />
            </div>
            <p class="text-[15px] font-semibold text-ink">拖拽二维码图片到这里</p>
            <p class="mt-1 text-[12.5px] text-ink-3">
              也可以点击选择图片，或按
              <kbd
                class="rounded border border-line bg-surface-2 px-1.5 py-0.5 text-[10.5px] font-semibold text-ink-2"
                >Ctrl</kbd
              >
              +
              <kbd
                class="rounded border border-line bg-surface-2 px-1.5 py-0.5 text-[10.5px] font-semibold text-ink-2"
                >V</kbd
              >
              粘贴截图
            </p>
            <div class="mt-4 flex items-center justify-center gap-2">
              <button
                type="button"
                class="inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-brand-gradient px-4 text-[12.5px] font-semibold text-white shadow-[0_10px_20px_-12px_rgba(99,102,241,0.8)]"
                @click.stop="pick"
              >
                <ImageUp :size="15" />
                {{ picking ? "读取中…" : "选择图片" }}
              </button>
              <button
                type="button"
                class="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-line bg-surface px-4 text-[12.5px] font-medium text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
                @click.stop="pasteFromClipboard"
              >
                <ClipboardPaste :size="15" />
                粘贴截图
              </button>
            </div>
          </div>

          <template v-else>
            <div class="flex items-center gap-3">
              <div
                class="relative grid size-24 shrink-0 place-items-center overflow-hidden rounded-xl border border-line bg-surface-2"
              >
                <img
                  v-if="previewUrl"
                  :src="previewUrl"
                  alt="待识别图片"
                  class="size-full object-contain p-1"
                />
                <div
                  v-if="state === 'working'"
                  class="absolute inset-0 grid place-items-center bg-surface/70"
                >
                  <LoaderCircle :size="22" class="animate-spin text-brand" />
                </div>
              </div>
              <div class="min-w-0 flex-1">
                <p class="truncate text-[13px] font-medium text-ink">{{ fileName }}</p>
                <p class="mt-0.5 text-[11.5px] text-ink-3">{{ stateText }}</p>
              </div>
              <button
                type="button"
                class="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-line bg-surface px-2.5 text-[12px] font-medium text-ink-2 transition-colors hover:border-line-strong hover:text-ink disabled:opacity-50"
                :disabled="busy"
                @click="pick"
              >
                <ImageUp :size="14" />
                换一张
              </button>
              <button
                type="button"
                class="grid size-8 shrink-0 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-surface-3 hover:text-ink-2"
                title="清空"
                @click="reset"
              >
                <X :size="15" />
              </button>
            </div>

            <div
              v-if="state === 'working'"
              class="rounded-xl border border-line bg-surface-2 px-4 py-10 text-center text-[12.5px] text-ink-2"
            >
              <LoaderCircle :size="20" class="mx-auto mb-2 animate-spin text-brand" />
              正在识别，请稍候…
            </div>

            <div
              v-else-if="state === 'error'"
              class="rounded-xl border border-[#f5d7d7] bg-[#fdf2f2] px-4 py-4"
            >
              <p class="flex items-center gap-2 text-[13px] font-semibold text-danger">
                <TriangleAlert :size="16" />
                没有识别到内容
              </p>
              <p class="mt-1.5 text-[12px] leading-relaxed text-ink-2">{{ errorMessage }}</p>
              <ul class="mt-2.5 list-disc space-y-1 pl-4 text-[11.5px] leading-relaxed text-ink-3">
                <li>确保二维码完整，四周留白没有被裁掉</li>
                <li>图片越清晰、对比度越高越容易识别</li>
                <li>截图时避免缩放模糊、反光或严重遮挡</li>
              </ul>
              <button
                type="button"
                class="mt-3 inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand-soft px-3 text-[12px] font-medium text-brand transition-colors hover:bg-brand-soft-2"
                @click="pick"
              >
                <ImageUp :size="14" />
                换一张图片
              </button>
            </div>

            <div v-else-if="result" class="overflow-hidden rounded-xl border border-line">
              <div
                class="flex items-center gap-2 border-b border-line bg-success-soft/60 px-4 py-2.5"
              >
                <CheckCircle2 :size="16" class="shrink-0 text-success" />
                <p class="text-[12.5px] font-semibold text-success">识别成功</p>
                <span
                  class="rounded-full border border-line bg-surface px-2 py-0.5 text-[11px] font-medium text-ink-2"
                >
                  {{ result.info.label }}
                </span>
                <button
                  type="button"
                  class="ml-auto inline-flex h-7 items-center gap-1 rounded-md border border-line bg-surface px-2 text-[11.5px] font-medium text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
                  @click="copyResult"
                >
                  <Copy :size="12" />
                  {{ copied ? "已复制" : "复制内容" }}
                </button>
              </div>

              <div class="flex flex-col gap-3.5 px-4 py-4">
                <div v-if="result.info.kind === 'url' && resultUrl">
                  <p class="text-[11px] font-semibold text-ink-3">链接</p>
                  <p class="mt-1 text-[13px] leading-relaxed font-medium break-all text-ink">
                    {{ resultUrl }}
                  </p>
                  <button
                    type="button"
                    class="mt-2 inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-[12px] font-medium text-ink-2 transition-colors hover:border-brand hover:text-brand"
                    @click="openExternal(resultUrl)"
                  >
                    <ExternalLink :size="14" />
                    打开链接
                  </button>
                </div>

                <div
                  v-else-if="result.info.kind === 'wifi' && wifiInfo"
                  class="flex flex-col gap-2"
                >
                  <div class="flex items-center justify-between gap-3">
                    <span class="text-[11.5px] text-ink-3">网络名称</span>
                    <span class="text-[12.5px] font-medium break-all text-ink">
                      {{ wifiInfo.ssid }}
                    </span>
                  </div>
                  <div class="flex items-center justify-between gap-3">
                    <span class="text-[11.5px] text-ink-3">密码</span>
                    <span class="flex items-center gap-1.5">
                      <span class="text-[12.5px] font-medium break-all text-ink tabular-nums">
                        {{ maskedPassword }}
                      </span>
                      <button
                        v-if="wifiInfo.password"
                        type="button"
                        class="grid size-6 place-items-center rounded-md text-ink-3 transition-colors hover:text-ink-2"
                        :title="showPassword ? '隐藏密码' : '显示密码'"
                        @click="showPassword = !showPassword"
                      >
                        <EyeOff v-if="showPassword" :size="13" />
                        <Eye v-else :size="13" />
                      </button>
                      <button
                        v-if="wifiInfo.password"
                        type="button"
                        class="grid size-6 place-items-center rounded-md text-ink-3 transition-colors hover:text-brand"
                        title="复制密码"
                        @click="copyPassword"
                      >
                        <Copy :size="13" />
                      </button>
                    </span>
                  </div>
                  <div class="flex items-center justify-between gap-3">
                    <span class="text-[11.5px] text-ink-3">加密方式</span>
                    <span class="text-[12.5px] font-medium text-ink">
                      {{ wifiInfo.encryption === "nopass" ? "无密码" : wifiInfo.encryption }}
                    </span>
                  </div>
                  <div v-if="wifiInfo.hidden" class="flex items-center justify-between gap-3">
                    <span class="text-[11.5px] text-ink-3">隐藏网络</span>
                    <span class="text-[12.5px] font-medium text-ink">是</span>
                  </div>
                </div>

                <div
                  v-else-if="result.info.kind === 'vcard' && vcardRows.length"
                  class="flex flex-col gap-2"
                >
                  <div
                    v-for="row in vcardRows"
                    :key="row.label"
                    class="flex items-center justify-between gap-3"
                  >
                    <span class="shrink-0 text-[11.5px] text-ink-3">{{ row.label }}</span>
                    <span class="min-w-0 text-right text-[12.5px] font-medium break-all text-ink">
                      {{ row.value }}
                    </span>
                  </div>
                </div>

                <div v-else-if="result.info.kind === 'email' && result.info.email">
                  <p class="text-[11px] font-semibold text-ink-3">邮件地址</p>
                  <p class="mt-1 text-[13px] font-medium break-all text-ink">
                    {{ result.info.email }}
                  </p>
                </div>

                <div v-else-if="result.info.kind === 'tel' && result.info.phone">
                  <p class="text-[11px] font-semibold text-ink-3">电话号码</p>
                  <p class="mt-1 text-[13px] font-medium break-all text-ink">
                    {{ result.info.phone }}
                  </p>
                </div>

                <div>
                  <p class="text-[11px] font-semibold text-ink-3">原始内容</p>
                  <pre
                    class="mt-1.5 max-h-44 overflow-auto rounded-lg border border-line bg-surface-2 px-3 py-2 text-[12px] leading-relaxed break-all whitespace-pre-wrap text-ink-2"
                    >{{ result.text }}</pre>
                </div>
              </div>
            </div>
          </template>
        </div>
      </section>
    </div>

    <aside
      class="sticky top-5 overflow-hidden rounded-2xl border border-line bg-surface shadow-card max-[980px]:static"
    >
      <header class="flex items-center gap-2 border-b border-line px-5 py-4">
        <Info :size="17" class="text-brand" />
        <h2 class="text-sm font-semibold">使用提示</h2>
      </header>

      <div class="flex flex-col gap-3.5 px-5 pt-4 pb-5 text-[12px] leading-relaxed text-ink-2">
        <div class="flex gap-2.5">
          <ClipboardPaste :size="15" class="mt-0.5 shrink-0 text-brand" />
          <p>
            截图后直接按
            <kbd
              class="rounded border border-line bg-surface-2 px-1.5 py-0.5 text-[10.5px] font-semibold text-ink-2"
              >Ctrl</kbd
            >
            +
            <kbd
              class="rounded border border-line bg-surface-2 px-1.5 py-0.5 text-[10.5px] font-semibold text-ink-2"
              >V</kbd
            >
            即可识别，无需先保存文件
          </p>
        </div>
        <div class="flex gap-2.5">
          <ScanLine :size="15" class="mt-0.5 shrink-0 text-brand" />
          <p>二维码尽量完整清晰，避免模糊、反光或大面积遮挡</p>
        </div>
        <div class="flex gap-2.5">
          <ImageUp :size="15" class="mt-0.5 shrink-0 text-brand" />
          <p>支持 PNG、JPG、WebP、BMP、GIF、SVG，拖拽或点击都能添加</p>
        </div>
      </div>
    </aside>
  </div>

  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="translate-y-2 opacity-0"
      enter-to-class="translate-y-0 opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="notice"
        class="pointer-events-none fixed bottom-8 left-1/2 z-50 -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-[12.5px] font-medium text-white shadow-lg"
      >
        {{ notice }}
      </div>
    </Transition>
  </Teleport>
</template>
