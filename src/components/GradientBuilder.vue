<script setup lang="ts">
import { computed, ref } from "vue";
import { ArrowUp, Blend, Copy, Plus, X } from "lucide-vue-next";
import ColorField from "@/components/ColorField.vue";
import { useRecentColors } from "@/composables/useRecentColors";
import { useToast } from "@/composables/useToast";
import { copyText } from "@/lib/clipboard";
import { mixHex } from "@/lib/color";

interface GradientStop {
  id: number;
  color: string;
}

interface GradientPreset {
  name: string;
  colors: string[];
}

const PRESETS: GradientPreset[] = [
  { name: "紫霞", colors: ["#6366F1", "#8B5CF6"] },
  { name: "日落", colors: ["#FF9A3C", "#FF5F6D"] },
  { name: "海洋", colors: ["#2193B0", "#6DD5ED"] },
  { name: "薄荷", colors: ["#11998E", "#38EF7D"] },
  { name: "蜜桃", colors: ["#FFECD2", "#FCB69F"] },
  { name: "极光", colors: ["#00C6FF", "#0072FF"] },
  { name: "玫瑰", colors: ["#F43F5E", "#FB7185"] },
  { name: "午夜", colors: ["#232526", "#414345"] },
];

const ANGLES = [0, 45, 90, 135, 180, 270];

const { add } = useRecentColors();
const { notify } = useToast();

const stops = ref<GradientStop[]>([
  { id: 1, color: "#6366F1" },
  { id: 2, color: "#8B5CF6" },
]);
const type = ref<"linear" | "radial">("linear");
const angle = ref(135);
let nextId = 3;

function positionOf(index: number): number {
  if (stops.value.length <= 1) {
    return 0;
  }
  return Math.round((index / (stops.value.length - 1)) * 100);
}

const gradient = computed(() => {
  const list = stops.value
    .map((stop, index) => `${stop.color.toUpperCase()} ${positionOf(index)}%`)
    .join(", ");
  return type.value === "linear"
    ? `linear-gradient(${angle.value}deg, ${list})`
    : `radial-gradient(circle, ${list})`;
});

const css = computed(() => `background: ${gradient.value};`);
const angleFill = computed<Record<string, string>>(() => ({
  "--fill": `${(angle.value / 360) * 100}%`,
}));

function addStop(): void {
  if (stops.value.length >= 4) {
    return;
  }
  const last = stops.value[stops.value.length - 1];
  const previous = stops.value[stops.value.length - 2] ?? last;
  stops.value.push({
    id: nextId,
    color: mixHex(previous.color, last.color, 0.5).toUpperCase(),
  });
  nextId += 1;
}

function removeStop(index: number): void {
  if (stops.value.length <= 2) {
    return;
  }
  stops.value.splice(index, 1);
}

function applyPreset(preset: GradientPreset): void {
  stops.value = preset.colors.map((color) => ({ id: nextId++, color }));
  notify(`已应用「${preset.name}」`);
}

async function copyColor(value: string): Promise<void> {
  const ok = await copyText(value);
  if (!ok) {
    notify("复制失败，请重试");
    return;
  }
  add(value);
  notify(`已复制 ${value}`);
}

async function copyCss(): Promise<void> {
  const ok = await copyText(css.value);
  if (!ok) {
    notify("复制失败，请重试");
    return;
  }
  stops.value.forEach((stop) => add(stop.color));
  notify("CSS 已复制");
}

async function copyGradient(): Promise<void> {
  const ok = await copyText(gradient.value);
  notify(ok ? "渐变值已复制" : "复制失败，请重试");
}
</script>

<template>
  <div class="grid grid-cols-[minmax(0,1fr)_336px] items-start gap-5 max-[980px]:grid-cols-1">
    <div class="flex min-w-0 flex-col gap-4">
      <section class="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
        <header class="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 class="flex items-center gap-2 text-sm font-semibold">
            <Blend :size="17" class="text-brand" />
            预览
          </h2>
          <span class="text-[11.5px] text-ink-3">
            {{ type === "linear" ? `线性 · ${angle}°` : "径向" }}
          </span>
        </header>
        <div class="px-5 pt-4 pb-5">
          <div
            class="h-[240px] w-full rounded-xl border border-line"
            :style="{ backgroundImage: gradient }"
          />
          <div class="mt-3 flex flex-wrap items-center gap-1.5">
            <span
              v-for="(stop, index) in stops"
              :key="stop.id"
              class="inline-flex h-7 items-center gap-1.5 rounded-md border border-line bg-surface-2 px-2 font-mono text-[11px] font-medium text-ink-2"
            >
              <span
                class="size-3 rounded-full border border-line"
                :style="{ backgroundColor: stop.color }"
              />
              {{ stop.color.toUpperCase() }}
              <span class="text-ink-3">{{ positionOf(index) }}%</span>
            </span>
          </div>
        </div>
      </section>

      <section class="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
        <header class="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 class="text-sm font-semibold">色标与方向</h2>
          <button
            type="button"
            class="inline-flex items-center gap-1 text-[11.5px] font-medium text-ink-2 transition-colors hover:text-brand disabled:cursor-not-allowed disabled:opacity-40"
            :disabled="stops.length >= 4"
            @click="addStop"
          >
            <Plus :size="13" />
            添加色标
          </button>
        </header>

        <div class="flex flex-col gap-5 px-5 pt-4 pb-5">
          <div class="flex flex-col gap-2">
            <div v-for="(stop, index) in stops" :key="stop.id" class="flex items-center gap-2">
              <ColorField
                v-model="stop.color"
                :label="`色标 ${index + 1}`"
                class="min-w-0 flex-1"
              />
              <span class="w-9 shrink-0 text-right text-[11px] text-ink-3 tabular-nums">
                {{ positionOf(index) }}%
              </span>
              <button
                type="button"
                class="grid size-8 shrink-0 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-surface-3 hover:text-brand"
                :title="`复制 ${stop.color.toUpperCase()}`"
                @click="copyColor(stop.color.toUpperCase())"
              >
                <Copy :size="13" />
              </button>
              <button
                type="button"
                class="grid size-8 shrink-0 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-surface-3 hover:text-danger disabled:invisible"
                :disabled="stops.length <= 2"
                title="移除色标"
                @click="removeStop(index)"
              >
                <X :size="14" />
              </button>
            </div>
            <p class="text-[11px] text-ink-3">色标位置会自动均匀分布，最多 4 个</p>
          </div>

          <div class="border-t border-line" />

          <div class="flex flex-col gap-2">
            <p class="text-[12.5px] font-semibold text-ink-2">类型</p>
            <div class="grid w-[220px] grid-cols-2 gap-1 rounded-[10px] bg-surface-2 p-1">
              <button
                v-for="option in [
                  { value: 'linear' as const, label: '线性渐变' },
                  { value: 'radial' as const, label: '径向渐变' },
                ]"
                :key="option.value"
                type="button"
                class="h-8 rounded-lg text-[12px] transition-colors"
                :class="
                  type === option.value
                    ? 'bg-surface font-semibold text-brand shadow-card'
                    : 'font-medium text-ink-2 hover:text-ink'
                "
                @click="type = option.value"
              >
                {{ option.label }}
              </button>
            </div>
          </div>

          <div v-if="type === 'linear'" class="flex flex-col gap-2.5">
            <div class="flex items-center justify-between">
              <p class="text-[12.5px] font-semibold text-ink-2">角度</p>
              <div class="flex items-center gap-2">
                <span
                  class="grid size-7 place-items-center rounded-md border border-line transition-transform"
                  :style="{ transform: `rotate(${angle}deg)` }"
                  aria-hidden="true"
                >
                  <ArrowUp :size="13" class="text-brand" />
                </span>
                <span
                  class="rounded-md bg-brand-soft px-2 py-0.5 text-[11.5px] font-semibold text-brand tabular-nums"
                >
                  {{ angle }}°
                </span>
              </div>
            </div>
            <input
              v-model.number="angle"
              type="range"
              min="0"
              max="360"
              step="1"
              class="range-slider"
              :style="angleFill"
              aria-label="渐变角度"
            />
            <div class="grid grid-cols-6 gap-1.5">
              <button
                v-for="value in ANGLES"
                :key="value"
                type="button"
                class="h-7 rounded-lg border text-[11px] font-medium transition-colors"
                :class="
                  angle === value
                    ? 'border-brand bg-brand-soft font-semibold text-brand'
                    : 'border-line bg-surface text-ink-2 hover:border-line-strong'
                "
                @click="angle = value"
              >
                {{ value }}°
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>

    <aside class="sticky top-5 flex flex-col gap-4 max-[980px]:static">
      <section class="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
        <header class="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 class="text-sm font-semibold">CSS</h2>
          <span class="text-[11.5px] text-ink-3">可直接用于 background</span>
        </header>
        <div class="flex flex-col gap-3 px-5 pt-4 pb-5">
          <code
            class="block max-h-[140px] overflow-auto rounded-xl border border-line bg-surface-2 px-3 py-2.5 font-mono text-[11px] leading-relaxed break-all whitespace-pre-wrap text-ink-2"
          >
            {{ css }}
          </code>
          <button
            type="button"
            class="inline-flex h-[42px] w-full items-center justify-center gap-2 rounded-[10px] bg-brand-gradient text-[13.5px] font-semibold text-white transition-all hover:brightness-105"
            @click="copyCss"
          >
            <Copy :size="16" />
            复制 CSS
          </button>
          <div class="flex items-center justify-between text-[11px]">
            <span class="text-ink-3">{{ stops.length }} 个色标</span>
            <button
              type="button"
              class="inline-flex items-center gap-1 text-ink-3 transition-colors hover:text-brand"
              @click="copyGradient"
            >
              <Copy :size="11" />
              复制渐变值
            </button>
          </div>
        </div>
      </section>

      <section class="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
        <header class="border-b border-line px-5 py-4">
          <h2 class="text-sm font-semibold">渐变预设</h2>
        </header>
        <div class="grid grid-cols-2 gap-2 px-5 pt-4 pb-5">
          <button
            v-for="preset in PRESETS"
            :key="preset.name"
            type="button"
            class="group relative h-16 overflow-hidden rounded-lg border border-black/5 transition-transform hover:scale-[1.03]"
            :style="{ backgroundImage: `linear-gradient(135deg, ${preset.colors.join(', ')})` }"
            :title="`应用 ${preset.name}`"
            @click="applyPreset(preset)"
          >
            <span
              class="absolute inset-x-0 bottom-0 bg-black/20 px-2 py-0.5 text-left text-[10.5px] font-medium text-white"
            >
              {{ preset.name }}
            </span>
          </button>
        </div>
      </section>
    </aside>
  </div>
</template>
