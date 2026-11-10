<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Copy, Palette, Pipette, Shuffle } from "lucide-vue-next";
import { useRecentColors } from "@/composables/useRecentColors";
import { useToast } from "@/composables/useToast";
import { isTauri } from "@/lib/backend";
import { copyText } from "@/lib/clipboard";
import {
  contrastRatio,
  formatColor,
  harmonyColors,
  hexToRgb,
  parseColor,
  randomHex,
  readableTextColor,
  relativeLuminance,
  shadesAndTints,
  type ColorFormat,
  type HarmonyMode,
} from "@/lib/color";

const props = defineProps<{ modelValue: string }>();
const emit = defineEmits<{ "update:modelValue": [value: string] }>();

const { recent, add, clear } = useRecentColors();
const { notify } = useToast();

const color = ref(props.modelValue.toUpperCase());
const alpha = ref(100);
const hexInput = ref(color.value);
const inputError = ref("");
const inputFocused = ref(false);
const harmonyMode = ref<HarmonyMode>("complementary");

const FORMATS: { key: ColorFormat; label: string }[] = [
  { key: "hex", label: "HEX" },
  { key: "rgb", label: "RGB" },
  { key: "hsl", label: "HSL" },
  { key: "hsv", label: "HSV" },
  { key: "cmyk", label: "CMYK" },
];

const HARMONY_MODES: { value: HarmonyMode; label: string }[] = [
  { value: "complementary", label: "互补色" },
  { value: "analogous", label: "邻近色" },
  { value: "triadic", label: "三角色" },
  { value: "split", label: "分裂互补" },
  { value: "tetradic", label: "四角色" },
  { value: "monochrome", label: "单色阶" },
];

const HARMONY_LABELS: Record<HarmonyMode, string[]> = {
  complementary: ["主色", "互补色"],
  analogous: ["-60°", "-30°", "主色", "+30°", "+60°"],
  triadic: ["主色", "+120°", "+240°"],
  split: ["主色", "+150°", "+210°"],
  tetradic: ["主色", "+90°", "+180°", "+270°"],
  monochrome: ["浅", "较浅", "主色", "较深", "深"],
};

watch(
  () => props.modelValue,
  (value) => {
    const next = value.toUpperCase();
    if (next === color.value) {
      return;
    }
    color.value = next;
    alpha.value = 100;
    if (!inputFocused.value) {
      hexInput.value = next;
    }
  },
);

watch(color, (value) => {
  if (!inputFocused.value) {
    hexInput.value = value;
  }
});

const rgb = computed(() => hexToRgb(color.value));
const luminance = computed(() => relativeLuminance(rgb.value));
const onWhite = computed(() => contrastRatio(color.value, "#ffffff"));
const onBlack = computed(() => contrastRatio(color.value, "#111827"));
const previewBackground = computed(() =>
  alpha.value >= 100
    ? color.value
    : `rgba(${rgb.value.r}, ${rgb.value.g}, ${rgb.value.b}, ${alpha.value / 100})`,
);
const alphaFill = computed<Record<string, string>>(() => ({ "--fill": `${alpha.value}%` }));

const formats = computed(() =>
  FORMATS.map((item) => ({
    label: item.label,
    value: formatColor(color.value, item.key, alpha.value / 100),
  })),
);

const shades = computed(() => shadesAndTints(color.value));
const harmony = computed(() => harmonyColors(color.value, harmonyMode.value));

function applyColor(
  hex: string,
  options: { alphaPercent?: number; record?: boolean; message?: string } = {},
): void {
  const value = hex.toUpperCase();
  color.value = value;
  if (options.alphaPercent !== undefined) {
    alpha.value = Math.min(100, Math.max(0, Math.round(options.alphaPercent)));
  }
  emit("update:modelValue", value);
  if (options.record) {
    add(value);
  }
  if (options.message) {
    notify(options.message);
  }
}

function onHexInput(): void {
  const parsed = parseColor(hexInput.value);
  inputError.value = parsed
    ? ""
    : hexInput.value.trim()
      ? "无法识别的颜色，支持 HEX / RGB / HSL"
      : "";
  if (!parsed) {
    return;
  }
  color.value = parsed.hex.toUpperCase();
  alpha.value = Math.round(parsed.alpha * 100);
  emit("update:modelValue", color.value);
}

function commitHex(): void {
  const parsed = parseColor(hexInput.value);
  if (!parsed) {
    inputError.value = "";
    hexInput.value = color.value.toUpperCase();
    return;
  }
  hexInput.value = parsed.hex.toUpperCase();
  applyColor(parsed.hex, {
    alphaPercent: parsed.alpha * 100,
    record: true,
  });
}

function onNativePick(event: Event): void {
  applyColor((event.target as HTMLInputElement).value);
}

function onNativeChange(): void {
  add(color.value);
}

function pickRandom(): void {
  const value = randomHex().toUpperCase();
  applyColor(value, { alphaPercent: 100, record: true, message: `随机颜色 ${value}` });
}

let stopDone: (() => void) | undefined;
let stopCancel: (() => void) | undefined;
let stopError: (() => void) | undefined;

onMounted(() => {
  if (!isTauri()) {
    return;
  }

  void (async () => {
    try {
      stopDone = await listen<string>("screen-picker:done", (event) => {
        const value = String(event.payload ?? "").toUpperCase();
        if (/^#[0-9A-F]{6}$/.test(value)) {
          applyColor(value, { alphaPercent: 100, record: true, message: "已从屏幕取色" });
        }
      });
      stopCancel = await listen("screen-picker:cancel", () => {
        notify("已取消屏幕取色");
      });
      stopError = await listen<string>("screen-picker:error", (event) => {
        notify(typeof event.payload === "string" ? event.payload : "屏幕取色启动失败，请重试");
      });
    } catch (error) {
      console.error(error);
    }
  })();
});

onUnmounted(() => {
  stopDone?.();
  stopCancel?.();
  stopError?.();
});

interface EyeDropperInstance {
  open(): Promise<{ sRGBHex: string }>;
}

type EyeDropperConstructor = new () => EyeDropperInstance;

async function pickFromScreen(): Promise<void> {
  if (isTauri()) {
    try {
      await invoke("start_screen_pick");
      notify("移动到目标颜色，点击左键拾取");
    } catch (error) {
      console.error(error);
      notify(typeof error === "string" ? error : "屏幕取色启动失败，请重试");
    }
    return;
  }

  const ctor = (window as unknown as { EyeDropper?: EyeDropperConstructor }).EyeDropper;
  if (!ctor) {
    notify("当前环境不支持屏幕取色，可以试试「图片取色」");
    return;
  }
  try {
    const result = await new ctor().open();
    applyColor(result.sRGBHex, { alphaPercent: 100, record: true, message: "已从屏幕取色" });
  } catch {
    // 用户取消取色
  }
}

async function copyValue(value: string, recordHex?: string): Promise<void> {
  const ok = await copyText(value);
  if (!ok) {
    notify("复制失败，请重试");
    return;
  }
  if (recordHex) {
    add(recordHex);
  }
  notify(`已复制 ${value}`);
}
</script>

<template>
  <div class="grid grid-cols-[minmax(0,1fr)_336px] items-start gap-5 max-[980px]:grid-cols-1">
    <div class="flex min-w-0 flex-col gap-4">
      <section class="border-line bg-surface shadow-card overflow-hidden rounded-2xl border">
        <header class="border-line flex items-center justify-between gap-3 border-b px-5 py-4">
          <h2 class="flex items-center gap-2 text-sm font-semibold">
            <Palette :size="17" class="text-brand" />
            颜色
          </h2>
          <span class="text-ink-3 text-[11.5px]">支持粘贴 HEX / RGB / HSL</span>
        </header>

        <div class="flex flex-col gap-4 px-5 pt-4 pb-5">
          <div class="flex items-center gap-2">
            <label
              class="bg-checkerboard border-line shadow-card relative size-11 shrink-0 cursor-pointer overflow-hidden rounded-xl border"
              title="打开系统取色器"
            >
              <span class="absolute inset-0" :style="{ backgroundColor: previewBackground }" />
              <input
                type="color"
                class="absolute inset-0 size-full cursor-pointer opacity-0"
                :value="color"
                aria-label="选择颜色"
                @input="onNativePick"
                @change="onNativeChange"
              />
            </label>

            <div class="relative min-w-0 flex-1">
              <input
                v-model="hexInput"
                type="text"
                spellcheck="false"
                class="field h-11 pr-10 font-mono text-[13px] font-semibold uppercase"
                placeholder="#5B5CF0"
                aria-label="颜色值"
                @focus="inputFocused = true"
                @input="onHexInput"
                @blur="
                  inputFocused = false;
                  commitHex();
                "
                @keydown.enter.prevent="commitHex"
              />
              <button
                type="button"
                class="text-ink-3 hover:text-brand absolute top-1/2 right-1.5 grid size-8 -translate-y-1/2 place-items-center rounded-lg transition-colors"
                title="复制当前 HEX"
                @click="copyValue(formats[0].value, color)"
              >
                <Copy :size="14" />
              </button>
            </div>

            <button
              type="button"
              class="border-line bg-surface text-ink-2 hover:border-line-strong hover:text-brand grid size-11 shrink-0 place-items-center rounded-[10px] border transition-colors"
              title="从屏幕取色"
              aria-label="从屏幕取色"
              @click="pickFromScreen"
            >
              <Pipette :size="17" />
            </button>
            <button
              type="button"
              class="border-line bg-surface text-ink-2 hover:border-line-strong hover:text-brand grid size-11 shrink-0 place-items-center rounded-[10px] border transition-colors"
              title="随机颜色"
              aria-label="随机颜色"
              @click="pickRandom"
            >
              <Shuffle :size="17" />
            </button>
          </div>

          <p v-if="inputError" class="text-danger -mt-1 text-[11.5px]">{{ inputError }}</p>

          <div class="flex items-center gap-3">
            <span class="text-ink-3 shrink-0 text-[11.5px]">不透明度</span>
            <input
              v-model.number="alpha"
              type="range"
              min="0"
              max="100"
              step="1"
              class="range-slider"
              :style="alphaFill"
              aria-label="不透明度"
            />
            <span
              class="bg-brand-soft text-brand w-12 shrink-0 rounded-md py-1 text-center text-[11.5px] font-semibold tabular-nums"
            >
              {{ alpha }}%
            </span>
          </div>

          <div class="border-line divide-line divide-y overflow-hidden rounded-xl border">
            <button
              v-for="item in formats"
              :key="item.label"
              type="button"
              class="group hover:bg-surface-2 flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors"
              :title="`复制 ${item.value}`"
              @click="copyValue(item.value, color)"
            >
              <span class="text-ink-3 w-12 shrink-0 text-[10.5px] font-semibold tracking-[0.06em]">
                {{ item.label }}
              </span>
              <span class="text-ink min-w-0 flex-1 truncate font-mono text-[12px] font-medium">
                {{ item.value }}
              </span>
              <Copy
                :size="13"
                class="text-ink-3 group-hover:text-brand shrink-0 opacity-0 transition-all group-hover:opacity-100"
              />
            </button>
          </div>
        </div>
      </section>

      <section class="border-line bg-surface shadow-card overflow-hidden rounded-2xl border">
        <header class="border-line flex items-center justify-between gap-3 border-b px-5 py-4">
          <h2 class="text-sm font-semibold">色阶</h2>
          <span class="text-ink-3 text-[11.5px]">点击色块复制</span>
        </header>
        <div class="px-5 pt-4 pb-5">
          <div class="grid grid-cols-5 gap-1.5 min-[980px]:grid-cols-10">
            <button
              v-for="shade in shades"
              :key="shade"
              type="button"
              class="group relative h-14 overflow-hidden rounded-lg border border-black/5 transition-transform hover:scale-[1.04]"
              :style="{ backgroundColor: shade }"
              :title="`复制 ${shade.toUpperCase()}`"
              @click="copyValue(shade.toUpperCase(), shade)"
            >
              <span
                class="absolute inset-x-0 bottom-1 text-[9.5px] font-semibold tabular-nums opacity-0 transition-opacity group-hover:opacity-100"
                :style="{ color: readableTextColor(shade) }"
              >
                {{ shade.toUpperCase() }}
              </span>
            </button>
          </div>
        </div>
      </section>

      <section class="border-line bg-surface shadow-card overflow-hidden rounded-2xl border">
        <header class="border-line flex items-center justify-between gap-3 border-b px-5 py-4">
          <h2 class="text-sm font-semibold">配色方案</h2>
          <span class="text-ink-3 text-[11.5px]">点击色块复制</span>
        </header>
        <div class="flex flex-col gap-3 px-5 pt-4 pb-5">
          <div class="grid grid-cols-3 gap-1.5 min-[620px]:grid-cols-6">
            <button
              v-for="mode in HARMONY_MODES"
              :key="mode.value"
              type="button"
              class="h-8 rounded-lg border text-[11.5px] font-medium transition-colors"
              :class="
                harmonyMode === mode.value
                  ? 'border-brand bg-brand-soft text-brand font-semibold'
                  : 'border-line bg-surface text-ink-2 hover:border-line-strong'
              "
              @click="harmonyMode = mode.value"
            >
              {{ mode.label }}
            </button>
          </div>

          <div
            class="grid gap-2"
            :style="{ gridTemplateColumns: `repeat(${harmony.length}, minmax(0, 1fr))` }"
          >
            <button
              v-for="(swatch, index) in harmony"
              :key="`${harmonyMode}-${swatch}`"
              type="button"
              class="group relative h-24 overflow-hidden rounded-xl border border-black/5 transition-transform hover:scale-[1.02]"
              :style="{ backgroundColor: swatch }"
              :title="`复制 ${swatch.toUpperCase()}`"
              @click="copyValue(swatch.toUpperCase(), swatch)"
            >
              <span
                class="absolute top-2 left-2.5 text-[10.5px] font-semibold"
                :style="{ color: readableTextColor(swatch), opacity: 0.72 }"
              >
                {{ HARMONY_LABELS[harmonyMode][index] }}
              </span>
              <span
                class="absolute inset-x-0 bottom-2 text-[11px] font-semibold tabular-nums"
                :style="{ color: readableTextColor(swatch) }"
              >
                {{ swatch.toUpperCase() }}
              </span>
            </button>
          </div>
        </div>
      </section>
    </div>

    <aside
      class="border-line bg-surface shadow-card sticky top-5 overflow-hidden rounded-2xl border max-[980px]:static max-[980px]:order-first"
    >
      <header class="border-line flex items-center justify-between border-b px-5 py-4">
        <h2 class="text-sm font-semibold">预览</h2>
        <span class="text-ink-3 text-[11.5px]">点击色块复制</span>
      </header>

      <div class="flex flex-col gap-4 px-5 pt-4 pb-5">
        <button
          type="button"
          class="border-line block w-full overflow-hidden rounded-xl border p-2 text-left"
          title="复制当前 HEX"
          @click="copyValue(formats[0].value, color)"
        >
          <div class="bg-checkerboard overflow-hidden rounded-lg">
            <div class="h-[148px] w-full" :style="{ backgroundColor: previewBackground }" />
          </div>
        </button>

        <div class="flex items-center justify-between gap-3">
          <p class="font-mono text-[17px] font-bold tracking-[-0.01em]">
            {{ color.toUpperCase() }}
          </p>
          <button
            type="button"
            class="text-ink-3 hover:bg-surface-3 hover:text-brand grid size-8 place-items-center rounded-lg transition-colors"
            title="复制 HEX"
            @click="copyValue(formats[0].value, color)"
          >
            <Copy :size="15" />
          </button>
        </div>

        <div class="text-ink-3 flex items-center justify-between text-[11.5px]">
          <span>不透明度 {{ alpha }}%</span>
          <span class="tabular-nums">亮度 {{ luminance.toFixed(3) }}</span>
        </div>

        <div class="grid grid-cols-2 gap-2">
          <div class="border-line bg-surface-2 rounded-lg border px-2.5 py-2">
            <p class="text-ink-3 text-[10.5px]">白底对比</p>
            <p class="text-ink mt-0.5 text-[12px] font-semibold tabular-nums">
              {{ onWhite.toFixed(2) }}:1
            </p>
          </div>
          <div class="border-line bg-surface-2 rounded-lg border px-2.5 py-2">
            <p class="text-ink-3 text-[10.5px]">黑底对比</p>
            <p class="text-ink mt-0.5 text-[12px] font-semibold tabular-nums">
              {{ onBlack.toFixed(2) }}:1
            </p>
          </div>
        </div>
      </div>

      <div class="border-line border-t px-5 pt-4 pb-5">
        <div class="mb-2.5 flex items-center justify-between">
          <p class="text-ink-2 text-[12.5px] font-semibold">最近使用</p>
          <button
            v-if="recent.length"
            type="button"
            class="text-ink-3 hover:text-danger text-[11px] transition-colors"
            @click="clear"
          >
            清空
          </button>
        </div>

        <div v-if="recent.length" class="grid grid-cols-9 gap-1.5">
          <button
            v-for="item in recent"
            :key="item"
            type="button"
            class="border-line aspect-square rounded-md border transition-transform hover:scale-110"
            :style="{ backgroundColor: item }"
            :title="`应用 ${item}`"
            @click="applyColor(item, { alphaPercent: 100, message: `已应用 ${item}` })"
          />
        </div>
        <p v-else class="text-ink-3 text-[11.5px] leading-relaxed">
          复制或应用过的颜色会自动记录在这里
        </p>
      </div>
    </aside>
  </div>
</template>
