<script setup lang="ts">
import { computed, ref } from "vue";
import { ArrowLeftRight, Copy, Eraser, Link2 } from "lucide-vue-next";
import { useToast } from "@/composables/useToast";
import { copyText } from "@/lib/clipboard";

const { notify } = useToast();

const mode = ref<"encode" | "decode">("encode");
const scope = ref<"component" | "full">("component");
const input = ref("");

const result = computed(() => {
  if (!input.value) {
    return { output: "", error: "" };
  }
  try {
    const output =
      mode.value === "encode"
        ? scope.value === "full"
          ? encodeURI(input.value)
          : encodeURIComponent(input.value)
        : scope.value === "full"
          ? decodeURI(input.value)
          : decodeURIComponent(input.value);
    return { output, error: "" };
  } catch {
    return { output: "", error: "解码失败，可能存在不完整的 % 转义序列" };
  }
});

function swap(): void {
  if (!result.value.output) {
    return;
  }
  input.value = result.value.output;
  mode.value = mode.value === "encode" ? "decode" : "encode";
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
        <Link2 :size="17" class="text-brand" />
        URL 编解码
      </h2>

      <div class="flex flex-wrap items-center gap-2">
        <div class="flex items-center gap-1 rounded-lg bg-surface-2 p-1">
          <button
            type="button"
            class="inline-flex h-7 items-center rounded-md px-2.5 text-[11.5px] transition-colors"
            :class="
              mode === 'encode'
                ? 'bg-surface font-semibold text-brand shadow-card'
                : 'font-medium text-ink-2 hover:text-ink'
            "
            @click="mode = 'encode'"
          >
            编码
          </button>
          <button
            type="button"
            class="inline-flex h-7 items-center rounded-md px-2.5 text-[11.5px] transition-colors"
            :class="
              mode === 'decode'
                ? 'bg-surface font-semibold text-brand shadow-card'
                : 'font-medium text-ink-2 hover:text-ink'
            "
            @click="mode = 'decode'"
          >
            解码
          </button>
        </div>

        <div class="flex items-center gap-1 rounded-lg bg-surface-2 p-1">
          <button
            type="button"
            class="inline-flex h-7 items-center rounded-md px-2.5 text-[11.5px] transition-colors"
            :class="
              scope === 'component'
                ? 'bg-surface font-semibold text-brand shadow-card'
                : 'font-medium text-ink-2 hover:text-ink'
            "
            title="编码参数值，转义 / ? & = 等符号"
            @click="scope = 'component'"
          >
            参数值
          </button>
          <button
            type="button"
            class="inline-flex h-7 items-center rounded-md px-2.5 text-[11.5px] transition-colors"
            :class="
              scope === 'full'
                ? 'bg-surface font-semibold text-brand shadow-card'
                : 'font-medium text-ink-2 hover:text-ink'
            "
            title="编码整条 URL，保留 :/?#&= 等结构符号"
            @click="scope = 'full'"
          >
            完整 URL
          </button>
        </div>
      </div>
    </header>

    <div class="grid grid-cols-2 items-start gap-4 px-5 pt-4 pb-5 max-[980px]:grid-cols-1">
      <div class="flex min-w-0 flex-col gap-2">
        <div class="flex items-center justify-between">
          <span class="text-[12px] font-medium text-ink-2">
            {{ mode === "encode" ? "原始内容" : "已编码内容" }}
          </span>
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

        <textarea
          v-model="input"
          rows="12"
          spellcheck="false"
          class="w-full resize-y rounded-[9px] border border-line bg-surface-2 px-3 py-2.5 font-mono text-[11.5px] leading-[1.7] break-all transition-colors outline-none focus:border-brand focus:bg-surface focus:shadow-[0_0_0_3px_var(--color-brand-soft)]"
          :placeholder="
            mode === 'encode'
              ? scope === 'full'
                ? 'https://example.com/搜索?q=工具箱'
                : '需要放进 URL 参数里的值…'
              : '%E6%8A%98%E5%88%80%E9%9B%80'
          "
        />
        <span class="text-[11px] leading-relaxed text-ink-3">
          {{
            scope === "component"
              ? "参数值模式会转义 / ? & = 等符号，适合单个查询参数"
              : "完整 URL 模式保留 : / ? # & = 等结构符号"
          }}
        </span>
      </div>

      <div class="flex min-w-0 flex-col gap-2">
        <div class="flex items-center justify-between">
          <span class="text-[12px] font-medium text-ink-2">
            {{ mode === "encode" ? "编码结果" : "解码结果" }}
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
          {{ result.output ? `${result.output.length} 字符` : "—" }}
        </span>
      </div>
    </div>
  </section>
</template>
