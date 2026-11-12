<script setup lang="ts">
import { computed, ref } from "vue";
import { ArrowLeftRight, Binary, Copy, Eraser, Wand2 } from "lucide-vue-next";
import { useToast } from "@/composables/useToast";
import { copyText } from "@/lib/clipboard";
import { decodeBase64, encodeBase64 } from "@/lib/dev";

const { notify } = useToast();

const mode = ref<"encode" | "decode">("encode");
const urlSafe = ref(false);
const input = ref("");

const result = computed(() => {
  if (!input.value.trim()) {
    return { output: "", error: "" };
  }
  try {
    const output =
      mode.value === "encode"
        ? encodeBase64(input.value, urlSafe.value)
        : decodeBase64(input.value);
    return { output, error: "" };
  } catch (error) {
    return {
      output: "",
      error: error instanceof Error ? error.message : "转换失败，请检查输入内容",
    };
  }
});

const inputBytes = computed(() => new TextEncoder().encode(input.value).length);
const outputBytes = computed(() =>
  result.value.output ? new TextEncoder().encode(result.value.output).length : 0,
);

function switchMode(next: "encode" | "decode"): void {
  if (mode.value === next) {
    return;
  }
  mode.value = next;
}

function swap(): void {
  if (!result.value.output) {
    return;
  }
  input.value = result.value.output;
  mode.value = mode.value === "encode" ? "decode" : "encode";
}

function loadSample(): void {
  input.value =
    mode.value === "encode"
      ? "折刀雀工具箱 · local only"
      : encodeBase64("折刀雀工具箱 · local only");
  notify("已填入示例内容");
}

function clear(): void {
  input.value = "";
}

async function copyOutput(): Promise<void> {
  if (!result.value.output) {
    return;
  }
  const ok = await copyText(result.value.output);
  notify(ok ? "结果已复制" : "复制失败，请重试");
}
</script>

<template>
  <section class="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
    <header
      class="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4"
    >
      <h2 class="flex items-center gap-2 text-sm font-semibold">
        <Binary :size="17" class="text-brand" />
        Base64 编解码
      </h2>

      <div class="flex flex-wrap items-center gap-2">
        <div class="flex items-center gap-1 rounded-lg bg-surface-2 p-1">
          <button
            type="button"
            class="inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-[11.5px] transition-colors"
            :class="
              mode === 'encode'
                ? 'bg-surface font-semibold text-brand shadow-card'
                : 'font-medium text-ink-2 hover:text-ink'
            "
            @click="switchMode('encode')"
          >
            编码
          </button>
          <button
            type="button"
            class="inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-[11.5px] transition-colors"
            :class="
              mode === 'decode'
                ? 'bg-surface font-semibold text-brand shadow-card'
                : 'font-medium text-ink-2 hover:text-ink'
            "
            @click="switchMode('decode')"
          >
            解码
          </button>
        </div>

        <button
          type="button"
          role="switch"
          :aria-checked="urlSafe"
          class="inline-flex h-8 items-center gap-2 rounded-lg border px-2.5 text-[11.5px] font-medium transition-colors"
          :class="
            urlSafe
              ? 'border-brand bg-brand-soft text-brand'
              : 'border-line bg-surface-2 text-ink-2 hover:border-line-strong'
          "
          @click="urlSafe = !urlSafe"
        >
          URL 安全
        </button>
      </div>
    </header>

    <div class="grid grid-cols-2 items-start gap-4 px-5 pt-4 pb-5 max-[980px]:grid-cols-1">
      <div class="flex min-w-0 flex-col gap-2">
        <div class="flex items-center justify-between">
          <span class="text-[12px] font-medium text-ink-2">
            {{ mode === "encode" ? "原始文本" : "Base64 文本" }}
          </span>
          <div class="flex items-center gap-3">
            <button
              type="button"
              class="inline-flex items-center gap-1 text-[11.5px] text-ink-3 transition-colors hover:text-brand"
              @click="loadSample"
            >
              <Wand2 :size="13" />
              示例
            </button>
            <button
              type="button"
              class="inline-flex items-center gap-1 text-[11.5px] text-ink-3 transition-colors hover:text-danger disabled:opacity-40"
              :disabled="!input"
              @click="clear"
            >
              <Eraser :size="13" />
              清空
            </button>
          </div>
        </div>

        <textarea
          v-model="input"
          rows="12"
          spellcheck="false"
          class="w-full resize-y rounded-[9px] border border-line bg-surface-2 px-3 py-2.5 font-mono text-[11.5px] leading-[1.7] break-all transition-colors outline-none focus:border-brand focus:bg-surface focus:shadow-[0_0_0_3px_var(--color-brand-soft)]"
          :placeholder="mode === 'encode' ? '输入需要编码的文本…' : '粘贴 Base64 字符串…'"
        />
        <span class="text-[11px] text-ink-3 tabular-nums">{{ inputBytes }} 字节</span>
      </div>

      <div class="flex min-w-0 flex-col gap-2">
        <div class="flex items-center justify-between">
          <span class="text-[12px] font-medium text-ink-2">
            {{ mode === "encode" ? "Base64 结果" : "解码结果" }}
          </span>
          <div class="flex items-center gap-3">
            <button
              type="button"
              class="inline-flex items-center gap-1 text-[11.5px] text-ink-3 transition-colors hover:text-brand disabled:opacity-40"
              :disabled="!result.output"
              @click="swap"
            >
              <ArrowLeftRight :size="13" />
              交换
            </button>
            <button
              type="button"
              class="inline-flex items-center gap-1 text-[11.5px] text-ink-3 transition-colors hover:text-brand disabled:opacity-40"
              :disabled="!result.output"
              @click="copyOutput"
            >
              <Copy :size="13" />
              复制
            </button>
          </div>
        </div>

        <div
          class="min-h-[236px] resize-y overflow-auto rounded-[9px] border px-3 py-2.5 font-mono text-[11.5px] leading-[1.7] break-all whitespace-pre-wrap"
          :class="
            result.error
              ? 'border-danger/40 bg-[#fdecec] text-danger'
              : 'border-line bg-surface-2 text-ink-2'
          "
        >
          {{ result.error || result.output || "// 结果会实时显示在这里" }}
        </div>
        <span class="text-[11px] text-ink-3 tabular-nums">
          {{ result.error ? "—" : `${outputBytes} 字节` }}
        </span>
      </div>
    </div>
  </section>
</template>
