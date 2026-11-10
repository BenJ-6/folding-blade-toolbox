<script setup lang="ts">
import { computed, ref } from "vue";
import { ArrowLeftRight, Check, Contrast, Copy, X } from "lucide-vue-next";
import ColorField from "@/components/ColorField.vue";
import { useToast } from "@/composables/useToast";
import { copyText } from "@/lib/clipboard";
import { contrastLevel, contrastRatio, suggestAccessibleColor } from "@/lib/color";

const { notify } = useToast();

const text = ref("#111827");
const background = ref("#FFFFFF");

const ratio = computed(() => contrastRatio(text.value, background.value));
const level = computed(() => contrastLevel(ratio.value));

const grade = computed(() => {
  if (level.value.aaaNormal) {
    return "AAA";
  }
  if (level.value.aaNormal) {
    return "AA";
  }
  if (level.value.aaLarge) {
    return "仅大字号 AA";
  }
  return "不达标";
});

const passed = computed(() => level.value.aaNormal);

const checks = computed(() => [
  { label: "正文 AA", detail: "≥ 4.5:1", pass: level.value.aaNormal },
  { label: "正文 AAA", detail: "≥ 7:1", pass: level.value.aaaNormal },
  { label: "大号文字 AA", detail: "≥ 3:1", pass: level.value.aaLarge },
  { label: "大号文字 AAA", detail: "≥ 4.5:1", pass: level.value.aaaLarge },
]);

const suggestion = computed(() =>
  passed.value ? null : suggestAccessibleColor(text.value, background.value, 4.5),
);

function swap(): void {
  const value = text.value;
  text.value = background.value;
  background.value = value;
  notify("已交换前景与背景色");
}

function applySuggestion(): void {
  if (!suggestion.value) {
    return;
  }
  text.value = suggestion.value;
  notify("已应用推荐文字色");
}

async function copyRatio(): Promise<void> {
  const value = `${ratio.value.toFixed(2)}:1`;
  const ok = await copyText(value);
  notify(ok ? `已复制 ${value}` : "复制失败，请重试");
}
</script>

<template>
  <div class="grid grid-cols-[minmax(0,1fr)_336px] items-start gap-5 max-[980px]:grid-cols-1">
    <div class="flex min-w-0 flex-col gap-4">
      <section class="border-line bg-surface shadow-card overflow-hidden rounded-2xl border">
        <header class="border-line flex items-center justify-between gap-3 border-b px-5 py-4">
          <h2 class="flex items-center gap-2 text-sm font-semibold">
            <Contrast :size="17" class="text-brand" />
            前景与背景
          </h2>
          <button
            type="button"
            class="text-ink-3 hover:text-brand inline-flex items-center gap-1 text-[11.5px] transition-colors"
            @click="swap"
          >
            <ArrowLeftRight :size="13" />
            交换颜色
          </button>
        </header>

        <div
          class="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-2.5 px-5 pt-4 pb-5"
        >
          <div class="flex min-w-0 flex-col gap-1.5">
            <span class="text-ink-2 text-[12px] font-medium">文字色</span>
            <ColorField v-model="text" label="文字色" />
          </div>
          <button
            type="button"
            class="border-line bg-surface text-ink-3 hover:border-brand hover:text-brand mb-0.5 grid size-9 shrink-0 place-items-center rounded-lg border transition-colors"
            title="交换颜色"
            aria-label="交换颜色"
            @click="swap"
          >
            <ArrowLeftRight :size="15" />
          </button>
          <div class="flex min-w-0 flex-col gap-1.5">
            <span class="text-ink-2 text-[12px] font-medium">背景色</span>
            <ColorField v-model="background" label="背景色" />
          </div>
        </div>
      </section>

      <section class="border-line bg-surface shadow-card overflow-hidden rounded-2xl border">
        <header class="border-line flex items-center justify-between gap-3 border-b px-5 py-4">
          <h2 class="text-sm font-semibold">阅读效果</h2>
          <span class="text-ink-3 text-[11.5px]">按当前配色实时渲染</span>
        </header>
        <div class="px-5 pt-4 pb-5">
          <div class="border-line rounded-xl border p-6" :style="{ backgroundColor: background }">
            <p class="text-[28px] leading-[1.25] font-bold" :style="{ color: text }">
              清晰易读的设计
            </p>
            <p class="mt-2 max-w-[560px] text-[14px] leading-relaxed" :style="{ color: text }">
              这段文字用于预览前景色与背景色的实际阅读效果。正常字号建议至少达到 4.5:1 的对比度。
            </p>
            <p class="mt-2 text-[12px]" :style="{ color: text, opacity: 0.82 }">
              辅助说明文字 · Small text
            </p>
          </div>
          <p class="text-ink-3 mt-3 text-[11px] leading-relaxed">
            WCAG 将 18.66px 加粗或 24px 以上的文字视为大号文字，大号文字可接受更低的对比度。
          </p>
        </div>
      </section>
    </div>

    <aside
      class="border-line bg-surface shadow-card sticky top-5 overflow-hidden rounded-2xl border max-[980px]:static max-[980px]:order-first"
    >
      <header class="border-line flex items-center justify-between gap-3 border-b px-5 py-4">
        <h2 class="text-sm font-semibold">对比度</h2>
        <span
          class="rounded-md px-2 py-0.5 text-[11px] font-semibold"
          :class="
            passed
              ? 'bg-success-soft text-success'
              : level.aaLarge
                ? 'bg-[#fff8e6] text-[#a16207]'
                : 'bg-surface-3 text-ink-2'
          "
        >
          {{ grade }}
        </span>
      </header>

      <div class="flex flex-col gap-4 px-5 pt-4 pb-5">
        <div>
          <p class="text-ink-3 text-[11.5px]">当前对比度</p>
          <div class="mt-0.5 flex items-end gap-2">
            <p class="text-[40px] leading-none font-bold tracking-[-0.03em] tabular-nums">
              {{ ratio.toFixed(2) }}
            </p>
            <span class="text-ink-3 mb-1 text-[13px] font-medium">:1</span>
          </div>
        </div>

        <div class="flex flex-col gap-1.5">
          <div
            v-for="check in checks"
            :key="check.label"
            class="flex items-center justify-between gap-2 rounded-lg border px-3 py-2"
            :class="check.pass ? 'border-success/25 bg-success-soft' : 'border-line bg-surface-2'"
          >
            <div>
              <p class="text-ink-2 text-[11.5px] font-medium">{{ check.label }}</p>
              <p class="text-ink-3 text-[10.5px] tabular-nums">对比度 {{ check.detail }}</p>
            </div>
            <Check v-if="check.pass" :size="15" class="text-success shrink-0" />
            <X v-else :size="14" class="text-ink-3 shrink-0" />
          </div>
        </div>

        <div
          v-if="suggestion"
          class="border-line bg-surface-2 flex flex-col gap-2 rounded-xl border p-3"
        >
          <div class="flex items-center gap-2">
            <span
              class="border-line size-7 shrink-0 rounded-md border"
              :style="{ backgroundColor: suggestion }"
            />
            <div class="min-w-0 flex-1">
              <p class="text-ink-3 text-[10.5px]">推荐文字色</p>
              <p class="font-mono text-[11.5px] font-semibold">{{ suggestion.toUpperCase() }}</p>
            </div>
            <button
              type="button"
              class="bg-brand-soft text-brand hover:bg-brand-soft-2 shrink-0 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors"
              @click="applySuggestion"
            >
              应用
            </button>
          </div>
          <p class="text-ink-3 text-[10.5px] leading-relaxed">
            保持色相不变，仅调整明度，使其达到 AA 正文标准
          </p>
        </div>

        <p
          v-else-if="passed"
          class="bg-success-soft text-success rounded-lg px-3 py-2 text-[11.5px] leading-relaxed"
        >
          当前配色已通过 WCAG AA 正文标准，适合用于正文文字
        </p>
        <p
          v-else
          class="rounded-lg bg-[#fff8e6] px-3 py-2 text-[11.5px] leading-relaxed text-[#a16207]"
        >
          当前背景很难通过调整前景达到 4.5:1，建议更换背景色
        </p>

        <button
          type="button"
          class="border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink inline-flex h-9 items-center justify-center gap-1.5 rounded-[9px] border text-[12px] font-medium transition-colors"
          @click="copyRatio"
        >
          <Copy :size="13" />
          复制对比度
        </button>
      </div>
    </aside>
  </div>
</template>
