<script setup lang="ts">
import { computed, ref } from "vue";
import { Braces, Copy, Eraser, Wand2 } from "lucide-vue-next";
import { useToast } from "@/composables/useToast";
import { copyText } from "@/lib/clipboard";
import { describeJsonError, formatJson } from "@/lib/dev";

const { notify } = useToast();

const input = ref("");
const indent = ref(2);
const sortKeys = ref(false);
const mode = ref<"pretty" | "minify">("pretty");

const result = computed(() => {
  if (!input.value.trim()) {
    return { output: "", error: "" };
  }
  try {
    return {
      output: formatJson(input.value, mode.value === "minify" ? 0 : indent.value, sortKeys.value),
      error: "",
    };
  } catch (error) {
    return { output: "", error: describeJsonError(input.value, error) };
  }
});

const stats = computed(() => {
  if (!result.value.output) {
    return "";
  }
  const lines = result.value.output.split("\n").length;
  return `${result.value.output.length} 字符 · ${lines} 行`;
});

const statusTone = computed(() => {
  if (!input.value.trim()) {
    return { label: "等待输入", class: "bg-surface-3 text-ink-2" };
  }
  if (result.value.error) {
    return { label: "语法错误", class: "bg-[#fdecec] text-danger" };
  }
  return { label: "有效 JSON", class: "bg-success-soft text-success" };
});

function loadSample(): void {
  input.value = JSON.stringify({
    name: "folding-blade-toolbox",
    version: "0.1.0",
    private: true,
    tags: ["tauri", "vue", "toolbox"],
    config: { theme: "light", local: true },
  });
  notify("已填入示例 JSON");
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

function useAsInput(): void {
  if (!result.value.output) {
    return;
  }
  input.value = result.value.output;
}
</script>

<template>
  <div
    class="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start gap-5 max-[980px]:grid-cols-1"
  >
    <section class="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
      <header class="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
        <h2 class="flex items-center gap-2 text-sm font-semibold">
          <Braces :size="17" class="text-brand" />
          输入 JSON
        </h2>
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
      </header>

      <div class="flex flex-col gap-3 px-5 pt-4 pb-5">
        <textarea
          v-model="input"
          rows="16"
          spellcheck="false"
          class="w-full resize-y rounded-[9px] border border-line bg-surface-2 px-3 py-2.5 font-mono text-[11.5px] leading-[1.7] transition-colors outline-none focus:border-brand focus:bg-surface focus:shadow-[0_0_0_3px_var(--color-brand-soft)]"
          placeholder='粘贴 JSON，例如 {"name": "toolbox", "local": true}'
        />

        <p v-if="result.error" class="text-[11.5px] leading-relaxed text-danger">
          {{ result.error }}
        </p>

        <div class="flex flex-wrap items-center gap-2">
          <div class="flex items-center gap-1 rounded-lg bg-surface-2 p-1">
            <button
              type="button"
              class="inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-[11.5px] transition-colors"
              :class="
                mode === 'pretty'
                  ? 'bg-surface font-semibold text-brand shadow-card'
                  : 'font-medium text-ink-2 hover:text-ink'
              "
              @click="mode = 'pretty'"
            >
              格式化
            </button>
            <button
              type="button"
              class="inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-[11.5px] transition-colors"
              :class="
                mode === 'minify'
                  ? 'bg-surface font-semibold text-brand shadow-card'
                  : 'font-medium text-ink-2 hover:text-ink'
              "
              @click="mode = 'minify'"
            >
              压缩
            </button>
          </div>

          <select
            v-model.number="indent"
            class="h-[34px] rounded-lg border border-line bg-surface-2 px-2 text-[11.5px] text-ink-2 outline-none focus:border-brand disabled:opacity-40"
            :disabled="mode === 'minify'"
            aria-label="缩进空格数"
          >
            <option :value="2">2 空格缩进</option>
            <option :value="4">4 空格缩进</option>
          </select>

          <button
            type="button"
            role="switch"
            :aria-checked="sortKeys"
            class="inline-flex h-[34px] items-center gap-2 rounded-lg border px-2.5 text-[11.5px] font-medium transition-colors"
            :class="
              sortKeys
                ? 'border-brand bg-brand-soft text-brand'
                : 'border-line bg-surface-2 text-ink-2 hover:border-line-strong'
            "
            @click="sortKeys = !sortKeys"
          >
            <span
              class="relative h-[14px] w-[24px] shrink-0 rounded-full transition-colors"
              :class="sortKeys ? 'bg-brand' : 'bg-surface-3'"
            >
              <span
                class="absolute top-[2px] size-[10px] rounded-full bg-white shadow transition-all"
                :class="sortKeys ? 'left-[12px]' : 'left-[2px]'"
              />
            </span>
            键名排序
          </button>
        </div>
      </div>
    </section>

    <section class="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
      <header class="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
        <h2 class="text-sm font-semibold">格式化结果</h2>
        <div class="flex items-center gap-3">
          <span class="rounded-md px-2 py-0.5 text-[11px] font-semibold" :class="statusTone.class">
            {{ statusTone.label }}
          </span>
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
      </header>

      <div class="flex flex-col gap-3 px-5 pt-4 pb-5">
        <pre
          class="max-h-[430px] min-h-[260px] overflow-auto rounded-[9px] bg-surface-2 p-3 font-mono text-[11.5px] leading-[1.7] break-words whitespace-pre-wrap text-ink-2"
          >{{ result.output || "// 结果会实时显示在这里" }}</pre>

        <div class="flex items-center justify-between gap-3">
          <span class="text-[11.5px] text-ink-3 tabular-nums">{{ stats }}</span>
          <button
            type="button"
            class="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 text-[11.5px] font-medium text-ink-2 transition-colors hover:border-line-strong hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
            :disabled="!result.output"
            @click="useAsInput"
          >
            结果作为输入
          </button>
        </div>
      </div>
    </section>
  </div>
</template>
