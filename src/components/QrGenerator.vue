<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from "vue";
import {
  ArrowLeftRight,
  Contact,
  Copy,
  Download,
  Eye,
  EyeOff,
  FileCode2,
  ImagePlus,
  Link2,
  Palette,
  QrCode,
  RotateCcw,
  Trash2,
  TriangleAlert,
  Type,
  Wifi,
} from "lucide-vue-next";
import { copyText } from "@/lib/clipboard";
import { saveImage } from "@/lib/files";
import {
  buildVcardPayload,
  buildWifiPayload,
  canvasToBlob,
  contrastRatio,
  drawQrCanvas,
  fileToDataUrl,
  loadImage,
  qrFileName,
  qrSvg,
  QR_SIZE_OPTIONS,
  type QrDotStyle,
  type QrEcc,
  type QrStyle,
  type VcardInput,
  type WifiEncryption,
  type WifiInput,
} from "@/lib/qr";

type ContentKind = "text" | "wifi" | "vcard";

const contentKinds = [
  { value: "text" as const, label: "文字 / 链接", icon: Link2 },
  { value: "wifi" as const, label: "Wi-Fi", icon: Wifi },
  { value: "vcard" as const, label: "名片", icon: Contact },
];

const dotStyles: { value: QrDotStyle; label: string }[] = [
  { value: "square", label: "方块" },
  { value: "rounded", label: "圆角" },
  { value: "dots", label: "圆点" },
];

const eccOptions: { value: QrEcc; label: string; desc: string }[] = [
  { value: "L", label: "L", desc: "7%" },
  { value: "M", label: "M", desc: "15%" },
  { value: "Q", label: "Q", desc: "25%" },
  { value: "H", label: "H", desc: "30%" },
];

const colorPresets = [
  { name: "经典黑", fg: "#111827", bg: "#ffffff" },
  { name: "品牌紫", fg: "#5b5cf0", bg: "#ffffff" },
  { name: "森林绿", fg: "#0e7f68", bg: "#ffffff" },
  { name: "砖红", fg: "#b42318", bg: "#ffffff" },
  { name: "深蓝", fg: "#1d4ed8", bg: "#ffffff" },
  { name: "反色", fg: "#ffffff", bg: "#111827" },
];

const kind = ref<ContentKind>("text");
const text = ref("");
const wifi = reactive<WifiInput>({
  ssid: "",
  password: "",
  encryption: "WPA" as WifiEncryption,
  hidden: false,
});
const vcard = reactive<VcardInput>({ name: "", org: "", tel: "", email: "", url: "" });

const style = reactive({
  ecc: "M" as QrEcc,
  margin: 2,
  dotStyle: "square" as QrDotStyle,
  fg: "#111827",
  bg: "#ffffff",
});
const exportSize = ref(1024);

const canvasRef = ref<HTMLCanvasElement | null>(null);
const logoInput = ref<HTMLInputElement | null>(null);
const logoImage = ref<HTMLImageElement | null>(null);
const logoDataUrl = ref("");
const previewError = ref("");
const actualSize = ref(0);
const moduleCount = ref(0);
const qrVersion = ref(0);
const showPassword = ref(false);
const notice = ref("");

const payload = computed(() => {
  if (kind.value === "text") {
    return text.value.trim() ? text.value : "";
  }
  if (kind.value === "wifi") {
    return wifi.ssid.trim() ? buildWifiPayload(wifi) : "";
  }
  return vcard.name.trim() ? buildVcardPayload(vcard) : "";
});

const effectiveEcc = computed<QrEcc>(() => (logoImage.value ? "H" : style.ecc));

const canExport = computed(() => Boolean(payload.value) && !previewError.value);

const contentHint = computed(() => {
  if (kind.value === "wifi") {
    return "扫码后手机会提示加入该 Wi-Fi";
  }
  if (kind.value === "vcard") {
    return "扫码后可一键保存联系人";
  }
  return isUrlText.value ? "扫码后会打开这个链接" : "扫码后会显示这段文字";
});

const isUrlText = computed(() => /^(https?:\/\/|www\.)\S+$/i.test(text.value.trim()));

const lowContrast = computed(() => contrastRatio(style.fg, style.bg) < 3);
const marginFill = computed<Record<string, string>>(() => ({
  "--fill": `${(style.margin / 8) * 100}%`,
}));

let noticeTimer: number | undefined;

function showNotice(message: string): void {
  notice.value = message;
  window.clearTimeout(noticeTimer);
  noticeTimer = window.setTimeout(() => {
    notice.value = "";
  }, 2200);
}

onUnmounted(() => {
  window.clearTimeout(noticeTimer);
});

onMounted(() => {
  render();
});

function render(): void {
  const canvas = canvasRef.value;
  if (!canvas) {
    return;
  }

  const value = payload.value;
  if (!value) {
    previewError.value = "";
    actualSize.value = 0;
    moduleCount.value = 0;
    qrVersion.value = 0;
    const ctx = canvas.getContext("2d");
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
    return;
  }

  const logo = logoImage.value;
  const runStyle: QrStyle = {
    size: exportSize.value,
    margin: style.margin,
    ecc: effectiveEcc.value,
    fg: style.fg,
    bg: style.bg,
    dotStyle: style.dotStyle,
  };

  try {
    const geometry = drawQrCanvas(
      canvas,
      value,
      runStyle,
      logo
        ? {
            source: logo,
            width: logo.naturalWidth || logo.width || 1,
            height: logo.naturalHeight || logo.height || 1,
          }
        : null,
    );
    actualSize.value = geometry.canvasSize;
    moduleCount.value = geometry.modules;
    qrVersion.value = geometry.version;
    previewError.value = "";
  } catch (error) {
    previewError.value = error instanceof Error ? error.message : "生成失败，请稍后重试";
    actualSize.value = 0;
    const ctx = canvas.getContext("2d");
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
  }
}

watch(
  [
    payload,
    exportSize,
    () => style.ecc,
    () => style.margin,
    () => style.fg,
    () => style.bg,
    () => style.dotStyle,
    logoImage,
  ],
  render,
  { immediate: true, flush: "post" },
);

function normalizeColor(key: "fg" | "bg"): void {
  const value = style[key].trim().toLowerCase();
  if (!/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/.test(value)) {
    style[key] = key === "fg" ? "#111827" : "#ffffff";
    return;
  }
  style[key] = value;
}

function swapColors(): void {
  const foreground = style.fg;
  style.fg = style.bg;
  style.bg = foreground;
}

function applyPreset(preset: (typeof colorPresets)[number]): void {
  style.fg = preset.fg;
  style.bg = preset.bg;
}

function isPresetActive(preset: (typeof colorPresets)[number]): boolean {
  return style.fg.toLowerCase() === preset.fg && style.bg.toLowerCase() === preset.bg;
}

function resetStyle(): void {
  style.ecc = "M";
  style.margin = 2;
  style.dotStyle = "square";
  style.fg = "#111827";
  style.bg = "#ffffff";
}

function pickLogo(): void {
  logoInput.value?.click();
}

async function onLogoChange(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) {
    return;
  }
  if (!file.type.startsWith("image/")) {
    showNotice("请选择图片文件");
    return;
  }
  if (file.size > 2 * 1024 * 1024) {
    showNotice("Logo 请控制在 2MB 以内");
    return;
  }
  try {
    const dataUrl = await fileToDataUrl(file);
    const image = await loadImage(dataUrl);
    logoImage.value = image;
    logoDataUrl.value = dataUrl;
    showNotice("Logo 已添加");
  } catch {
    showNotice("Logo 读取失败，请换一张");
  }
}

function removeLogo(): void {
  logoImage.value = null;
  logoDataUrl.value = "";
}

async function downloadPng(): Promise<void> {
  const canvas = canvasRef.value;
  if (!canvas || !canExport.value) {
    return;
  }
  try {
    const blob = await canvasToBlob(canvas);
    const saved = await saveImage(blob, qrFileName(payload.value, "png"));
    if (saved) {
      showNotice("PNG 已保存");
    }
  } catch {
    showNotice("保存失败，请重试");
  }
}

async function copyImage(): Promise<void> {
  const canvas = canvasRef.value;
  if (!canvas || !canExport.value) {
    return;
  }
  try {
    const blob = await canvasToBlob(canvas);
    if (
      navigator.clipboard &&
      "write" in navigator.clipboard &&
      typeof ClipboardItem !== "undefined"
    ) {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      showNotice("二维码图片已复制");
      return;
    }
    await saveImage(blob, qrFileName(payload.value, "png"));
    showNotice("当前环境不支持复制图片，已为你下载");
  } catch {
    try {
      const blob = await canvasToBlob(canvas);
      await saveImage(blob, qrFileName(payload.value, "png"));
      showNotice("复制失败，已为你下载图片");
    } catch {
      showNotice("复制失败，请重试");
    }
  }
}

async function downloadSvg(): Promise<void> {
  if (!canExport.value) {
    return;
  }
  try {
    const svg = qrSvg(
      payload.value,
      {
        size: exportSize.value,
        margin: style.margin,
        ecc: effectiveEcc.value,
        fg: style.fg,
        bg: style.bg,
        dotStyle: style.dotStyle,
      },
      logoDataUrl.value || null,
    );
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const saved = await saveImage(blob, qrFileName(payload.value, "svg"));
    if (saved) {
      showNotice("SVG 已保存");
    }
  } catch {
    showNotice("保存失败，请重试");
  }
}

async function copyContent(): Promise<void> {
  if (!payload.value) {
    return;
  }
  const ok = await copyText(payload.value);
  showNotice(ok ? "内容已复制" : "复制失败，请重试");
}
</script>

<template>
  <div class="grid grid-cols-[minmax(0,1fr)_336px] items-start gap-5 max-[980px]:grid-cols-1">
    <div class="flex min-w-0 flex-col gap-4">
      <section class="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
        <header class="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 class="flex items-center gap-2 text-sm font-semibold">
            <Type :size="17" class="text-brand" />
            内容
          </h2>
          <span class="text-[11.5px] text-ink-3">扫码后看到的内容</span>
        </header>

        <div class="flex flex-col gap-3.5 px-5 pt-4 pb-5">
          <div class="grid grid-cols-3 gap-1 rounded-[10px] bg-surface-2 p-1">
            <button
              v-for="option in contentKinds"
              :key="option.value"
              type="button"
              class="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg text-[12.5px] transition-colors"
              :class="
                kind === option.value
                  ? 'bg-surface font-semibold text-brand shadow-card'
                  : 'font-medium text-ink-2 hover:text-ink'
              "
              @click="kind = option.value"
            >
              <component :is="option.icon" :size="14" />
              {{ option.label }}
            </button>
          </div>

          <template v-if="kind === 'text'">
            <textarea
              v-model="text"
              rows="4"
              class="w-full resize-none rounded-[9px] border border-line bg-surface-2 px-3 py-2.5 text-[13px] leading-relaxed transition-colors outline-none focus:border-brand focus:bg-surface focus:shadow-[0_0_0_3px_var(--color-brand-soft)]"
              placeholder="输入网址（如 https://example.com）或任意文字…"
            />
            <div class="flex items-center justify-between gap-3">
              <p class="text-[11.5px] text-ink-3">
                {{ isUrlText ? "识别为链接，扫码后可直接打开" : "扫码后会显示这段文字" }}
              </p>
              <span class="shrink-0 text-[11.5px] text-ink-3 tabular-nums">
                {{ text.length }} 字符
              </span>
            </div>
          </template>

          <template v-else-if="kind === 'wifi'">
            <div class="flex flex-col gap-1.5">
              <span class="text-[12px] font-medium text-ink-2">网络名称（SSID）</span>
              <input v-model="wifi.ssid" type="text" class="field" placeholder="例如 Home-WiFi" />
            </div>

            <div class="flex flex-col gap-1.5">
              <span class="text-[12px] font-medium text-ink-2">密码</span>
              <div class="relative">
                <input
                  v-model="wifi.password"
                  :type="showPassword ? 'text' : 'password'"
                  class="field pr-9"
                  :disabled="wifi.encryption === 'nopass'"
                  :placeholder="
                    wifi.encryption === 'nopass' ? '无密码网络，无需填写' : 'Wi-Fi 密码'
                  "
                />
                <button
                  type="button"
                  class="absolute top-1/2 right-2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-ink-3 transition-colors hover:text-ink-2"
                  :title="showPassword ? '隐藏密码' : '显示密码'"
                  @click="showPassword = !showPassword"
                >
                  <EyeOff v-if="showPassword" :size="14" />
                  <Eye v-else :size="14" />
                </button>
              </div>
              <p
                v-if="wifi.encryption !== 'nopass' && !wifi.password"
                class="text-[11px] text-[#a16207]"
              >
                未填写密码，扫码后会提示手动输入
              </p>
            </div>

            <div class="flex flex-col gap-1.5">
              <span class="text-[12px] font-medium text-ink-2">加密方式</span>
              <select v-model="wifi.encryption" class="field">
                <option value="WPA">WPA / WPA2 / WPA3</option>
                <option value="WEP">WEP</option>
                <option value="nopass">无密码</option>
              </select>
            </div>

            <div
              class="flex items-center justify-between gap-3 rounded-[9px] border border-line bg-surface-2 px-3 py-2"
            >
              <div>
                <p class="text-[12px] font-medium text-ink-2">隐藏网络</p>
                <p class="text-[11px] text-ink-3">路由器不广播 SSID 时开启</p>
              </div>
              <button
                type="button"
                role="switch"
                :aria-checked="wifi.hidden"
                class="relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors"
                :class="wifi.hidden ? 'bg-brand' : 'bg-surface-3'"
                @click="wifi.hidden = !wifi.hidden"
              >
                <span
                  class="absolute top-[3px] size-4 rounded-full bg-white shadow transition-all"
                  :class="wifi.hidden ? 'left-[19px]' : 'left-[3px]'"
                />
              </button>
            </div>

            <p class="text-[11.5px] leading-relaxed text-ink-3">
              填入后，扫码会直接弹出加入网络提示；密码不会上传到任何服务器
            </p>
          </template>

          <template v-else>
            <div class="grid grid-cols-2 gap-2.5">
              <div class="col-span-2 flex flex-col gap-1.5">
                <span class="text-[12px] font-medium text-ink-2"
                  >姓名 <span class="text-danger">*</span></span
                >
                <input v-model="vcard.name" type="text" class="field" placeholder="例如 张三" />
              </div>
              <div class="flex flex-col gap-1.5">
                <span class="text-[12px] font-medium text-ink-2">电话</span>
                <input v-model="vcard.tel" type="text" class="field" placeholder="可选" />
              </div>
              <div class="flex flex-col gap-1.5">
                <span class="text-[12px] font-medium text-ink-2">公司</span>
                <input v-model="vcard.org" type="text" class="field" placeholder="可选" />
              </div>
              <div class="col-span-2 flex flex-col gap-1.5">
                <span class="text-[12px] font-medium text-ink-2">邮箱</span>
                <input v-model="vcard.email" type="text" class="field" placeholder="可选" />
              </div>
              <div class="col-span-2 flex flex-col gap-1.5">
                <span class="text-[12px] font-medium text-ink-2">网址</span>
                <input v-model="vcard.url" type="text" class="field" placeholder="可选" />
              </div>
            </div>
            <p class="text-[11.5px] leading-relaxed text-ink-3">
              扫码后手机会提示保存联系人，姓名必填
            </p>
          </template>
        </div>
      </section>

      <section class="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
        <header class="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 class="flex items-center gap-2 text-sm font-semibold">
            <Palette :size="17" class="text-brand" />
            外观设置
          </h2>
          <button
            type="button"
            class="inline-flex items-center gap-1 text-xs text-ink-3 transition-colors hover:text-brand"
            @click="resetStyle"
          >
            <RotateCcw :size="12" />
            恢复默认
          </button>
        </header>

        <div class="flex flex-col gap-5 px-5 pt-4 pb-5">
          <div class="flex flex-col gap-2">
            <p class="text-[12.5px] font-semibold text-ink-2">码点样式</p>
            <div class="grid grid-cols-3 gap-1.5">
              <button
                v-for="option in dotStyles"
                :key="option.value"
                type="button"
                class="h-8 rounded-lg border text-[11.5px] font-medium transition-colors"
                :class="
                  style.dotStyle === option.value
                    ? 'border-brand bg-brand-soft font-semibold text-brand'
                    : 'border-line bg-surface text-ink-2 hover:border-line-strong'
                "
                @click="style.dotStyle = option.value"
              >
                {{ option.label }}
              </button>
            </div>
          </div>

          <div class="flex flex-col gap-2">
            <div class="flex items-center justify-between">
              <p class="text-[12.5px] font-semibold text-ink-2">颜色</p>
              <button
                type="button"
                class="inline-flex items-center gap-1 text-[11.5px] text-ink-3 transition-colors hover:text-brand"
                title="交换前景与背景色"
                @click="swapColors"
              >
                <ArrowLeftRight :size="13" />
                交换
              </button>
            </div>

            <div class="grid grid-cols-2 gap-2">
              <div
                class="flex items-center gap-2 rounded-[9px] border border-line bg-surface-2 px-2 py-1.5"
              >
                <input
                  v-model="style.fg"
                  type="color"
                  class="size-6 shrink-0 cursor-pointer rounded border border-line bg-transparent p-0"
                  aria-label="前景色"
                  @blur="normalizeColor('fg')"
                />
                <div class="min-w-0 flex-1">
                  <p class="text-[10.5px] text-ink-3">前景</p>
                  <input
                    v-model="style.fg"
                    type="text"
                    class="w-full bg-transparent text-[11.5px] font-medium text-ink uppercase outline-none"
                    @blur="normalizeColor('fg')"
                  />
                </div>
              </div>
              <div
                class="flex items-center gap-2 rounded-[9px] border border-line bg-surface-2 px-2 py-1.5"
              >
                <input
                  v-model="style.bg"
                  type="color"
                  class="size-6 shrink-0 cursor-pointer rounded border border-line bg-transparent p-0"
                  aria-label="背景色"
                  @blur="normalizeColor('bg')"
                />
                <div class="min-w-0 flex-1">
                  <p class="text-[10.5px] text-ink-3">背景</p>
                  <input
                    v-model="style.bg"
                    type="text"
                    class="w-full bg-transparent text-[11.5px] font-medium text-ink uppercase outline-none"
                    @blur="normalizeColor('bg')"
                  />
                </div>
              </div>
            </div>

            <div class="flex items-center gap-1.5">
              <button
                v-for="preset in colorPresets"
                :key="preset.name"
                type="button"
                class="size-7 rounded-full border-2 transition-transform hover:scale-105"
                :class="isPresetActive(preset) ? 'border-brand' : 'border-line'"
                :style="{ background: preset.fg }"
                :title="preset.name"
                @click="applyPreset(preset)"
              />
            </div>
          </div>

          <div class="flex flex-col gap-2">
            <div class="flex items-center justify-between">
              <p class="text-[12.5px] font-semibold text-ink-2">纠错等级</p>
              <span v-if="logoImage" class="text-[11px] font-medium text-brand">
                已自动使用 H
              </span>
            </div>
            <div class="grid grid-cols-4 gap-1.5">
              <button
                v-for="option in eccOptions"
                :key="option.value"
                type="button"
                class="flex h-10 flex-col items-center justify-center rounded-lg border transition-colors disabled:cursor-not-allowed"
                :class="
                  effectiveEcc === option.value
                    ? 'border-brand bg-brand-soft text-brand'
                    : 'border-line bg-surface text-ink-2 hover:border-line-strong'
                "
                :disabled="Boolean(logoImage)"
                @click="style.ecc = option.value"
              >
                <span class="text-[12px] font-semibold">{{ option.label }}</span>
                <span class="text-[10px] opacity-70">容错 {{ option.desc }}</span>
              </button>
            </div>
            <p class="text-[11px] leading-relaxed text-ink-3">
              等级越高越耐污损和遮挡，可容纳的内容也越少
            </p>
          </div>

          <div class="flex flex-col gap-2">
            <div class="flex items-center justify-between">
              <p class="text-[12.5px] font-semibold text-ink-2">四周留白</p>
              <span
                class="rounded-md bg-brand-soft px-2 py-0.5 text-[11.5px] font-semibold text-brand"
              >
                {{ style.margin }} 格
              </span>
            </div>
            <input
              v-model.number="style.margin"
              type="range"
              min="0"
              max="8"
              step="1"
              class="range-slider"
              :style="marginFill"
            />
            <p
              v-if="style.margin < 2"
              class="rounded-lg bg-[#fff8e6] px-3 py-2 text-[11.5px] leading-relaxed text-[#a16207]"
            >
              留白太少，部分扫码工具可能无法识别，建议 2 格以上
            </p>
            <p v-else class="text-[11px] text-ink-3">留白指二维码四周的空白边距</p>
          </div>

          <div class="flex flex-col gap-2">
            <div class="flex items-center justify-between">
              <p class="text-[12.5px] font-semibold text-ink-2">中心 Logo</p>
              <span class="text-[11px] text-ink-3">可选</span>
            </div>
            <input
              ref="logoInput"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              class="hidden"
              @change="onLogoChange"
            />
            <div class="flex items-center gap-2">
              <button
                type="button"
                class="inline-flex h-9 items-center gap-1.5 rounded-[9px] border border-dashed border-line-strong bg-surface-2 px-3 text-[12px] font-medium text-ink-2 transition-colors hover:border-brand hover:text-brand"
                @click="pickLogo"
              >
                <ImagePlus :size="15" />
                {{ logoImage ? "更换 Logo" : "上传 Logo" }}
              </button>
              <template v-if="logoImage">
                <img
                  :src="logoDataUrl"
                  alt="Logo 预览"
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
            <p class="text-[11px] leading-relaxed text-ink-3">
              建议使用正方形、背景简单的图片，添加后自动提升到最高纠错等级
            </p>
          </div>
        </div>
      </section>
    </div>

    <aside
      class="sticky top-5 overflow-hidden rounded-2xl border border-line bg-surface shadow-card max-[980px]:static max-[980px]:order-first"
    >
      <header class="flex items-center justify-between border-b border-line px-5 py-4">
        <h2 class="flex items-center gap-2 text-sm font-semibold">
          <QrCode :size="17" class="text-brand" />
          预览
        </h2>
        <span
          v-if="canExport"
          class="rounded-md bg-brand-soft px-2 py-0.5 text-[11px] font-semibold text-brand tabular-nums"
        >
          {{ actualSize }} px
        </span>
      </header>

      <div class="flex flex-col gap-4 px-5 pt-4 pb-5">
        <div class="relative overflow-hidden rounded-xl border border-line bg-white p-3">
          <canvas
            ref="canvasRef"
            width="1024"
            height="1024"
            class="block h-auto w-full [image-rendering:pixelated]"
            aria-label="二维码预览"
          />
          <div
            v-if="!payload"
            class="absolute inset-3 grid place-items-center rounded-lg border border-dashed border-line-strong bg-surface-2/70 text-center"
          >
            <div class="px-4">
              <QrCode :size="30" class="mx-auto mb-2 text-ink-3" :stroke-width="1.6" />
              <p class="text-[12.5px] font-medium text-ink-2">等待内容</p>
              <p class="mt-0.5 text-[11.5px] text-ink-3">在左侧输入后自动生成</p>
            </div>
          </div>
          <div
            v-else-if="previewError"
            class="absolute inset-3 grid place-items-center rounded-lg bg-surface-2/95 text-center"
          >
            <div class="px-4">
              <TriangleAlert :size="28" class="mx-auto mb-2 text-danger" :stroke-width="1.7" />
              <p class="text-[12px] leading-relaxed font-medium text-danger">
                {{ previewError }}
              </p>
            </div>
          </div>
        </div>

        <p v-if="canExport" class="-mt-1 text-center text-[11.5px] text-ink-3">
          {{ contentHint }}
        </p>

        <div v-if="canExport" class="flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <p class="text-[12.5px] font-semibold text-ink-2">导出尺寸</p>
            <span class="text-[11.5px] text-ink-3">PNG / SVG</span>
          </div>
          <div class="grid grid-cols-4 gap-1.5">
            <button
              v-for="size in QR_SIZE_OPTIONS"
              :key="size"
              type="button"
              class="h-8 rounded-lg border text-[11.5px] font-medium transition-colors"
              :class="
                exportSize === size
                  ? 'border-brand bg-brand-soft font-semibold text-brand'
                  : 'border-line bg-surface text-ink-2 hover:border-line-strong'
              "
              @click="exportSize = size"
            >
              {{ size }}
            </button>
          </div>
        </div>

        <div class="flex flex-col gap-2">
          <button
            type="button"
            class="inline-flex h-[42px] w-full items-center justify-center gap-2 rounded-[10px] bg-brand-gradient text-[13.5px] font-semibold text-white transition-all hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="!canExport"
            @click="downloadPng"
          >
            <Download :size="16" />
            下载 PNG
          </button>
          <div class="grid grid-cols-2 gap-2">
            <button
              type="button"
              class="inline-flex h-9 items-center justify-center gap-1.5 rounded-[9px] border border-line bg-surface text-[12.5px] font-medium text-ink-2 transition-colors hover:border-line-strong hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
              :disabled="!canExport"
              @click="copyImage"
            >
              <Copy :size="14" />
              复制图片
            </button>
            <button
              type="button"
              class="inline-flex h-9 items-center justify-center gap-1.5 rounded-[9px] border border-line bg-surface text-[12.5px] font-medium text-ink-2 transition-colors hover:border-line-strong hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
              :disabled="!canExport"
              @click="downloadSvg"
            >
              <FileCode2 :size="14" />
              下载 SVG
            </button>
          </div>
          <button
            type="button"
            class="inline-flex h-7 items-center justify-center gap-1 text-[11.5px] text-ink-3 transition-colors hover:text-brand disabled:cursor-not-allowed disabled:opacity-40"
            :disabled="!canExport"
            @click="copyContent"
          >
            <Copy :size="12" />
            复制二维码内容
          </button>
        </div>

        <p
          v-if="lowContrast && payload"
          class="rounded-lg bg-[#fff8e6] px-3 py-2 text-[11.5px] leading-relaxed text-[#a16207]"
        >
          前景与背景对比度偏低，部分手机可能扫不出来，建议使用深色前景和浅色背景
        </p>

        <p v-if="canExport" class="text-center text-[11px] text-ink-3">
          版本 {{ qrVersion }} · {{ moduleCount }}×{{ moduleCount }} 模块
        </p>
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
