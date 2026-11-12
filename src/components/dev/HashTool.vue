<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Copy, Eraser, Hash } from "lucide-vue-next";
import { useToast } from "@/composables/useToast";
import { copyText } from "@/lib/clipboard";
import { hashText, type HashAlgorithm } from "@/lib/dev";

const { notify } = useToast();

const algorithms: HashAlgorithm[] = ["SHA-1", "SHA-256", "SHA-384", "SHA-512"];

const input = ref("");
const hashes = ref<{ algorithm: HashAlgorithm; value: string }[]>([]);
const error = ref("");
let requestId = 0;

watch(
  input,
  async (value) => {
    requestId += 1;
    const current = requestId;

    if (!value) {
      hashes.value = [];
      error.value = "";
      return;
    }

    try {
      const result = await Promise.all(
        algorithms.map(async (algorithm) => ({
          algorithm,
          value: await hashText(algorithm, value),
        })),
      );
      if (current !== requestId) {
        return;
      }
      hashes.value = result;
      error.value = "";
    } catch (caught) {
      if (current !== requestId) {
        return;
      }
      hashes.value = [];
      error.value = caught instanceof Error ? caught.message : "哈希计算失败";
    }
  },
  { immediate: true },
);

const inputBytes = computed(() => (input.value ? new TextEncoder().encode(input.value).length : 0));

const hashMap = computed<Record<string, string>>(() =>
  Object.fromEntries(hashes.value.map((item) => [item.algorithm, item.value])),
);

function clear(): void {
  input.value = "";
}

async function copy(value: string, label: string): Promise<void> {
  const ok = await copyText(value);
  notify(ok ? `${label} 已复制` : "复制失败，请重试");
}
</script>

<template>
  <div class="grid grid-cols-[minmax(0,1fr)_380px] items-start gap-5 max-[980px]:grid-cols-1">
    <section class="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
      <header class="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
        <h2 class="flex items-center gap-2 text-sm font-semibold">
          <Hash :size="17" class="text-brand" />
          文本哈希
        </h2>
        <button
          type="button"
          class="inline-flex items-center gap-1 text-[11.5px] text-ink-3 transition-colors hover:text-danger disabled:opacity-40"
          :disabled="!input"
          @click="clear"
        >
          <Eraser :size="13" />
          清空
        </button>
      </header>

      <div class="flex flex-col gap-3 px-5 pt-4 pb-5">
        <textarea
          v-model="input"
          rows="14"
          spellcheck="false"
          class="w-full resize-y rounded-[9px] border border-line bg-surface-2 px-3 py-2.5 font-mono text-[11.5px] leading-[1.7] transition-colors outline-none focus:border-brand focus:bg-surface focus:shadow-[0_0_0_3px_var(--color-brand-soft)]"
          placeholder="输入需要计算哈希的文本，结果会实时更新…"
        />

        <div class="flex items-center justify-between gap-3">
          <span class="text-[11.5px] text-ink-3 tabular-nums">
            {{ input ? `${inputBytes} 字节` : "—" }}
          </span>
          <span class="text-[11px] text-ink-3">使用 Web Crypto 计算</span>
        </div>

        <p v-if="error" class="rounded-lg bg-[#fdecec] px-3 py-2 text-[11.5px] text-danger">
          {{ error }}
        </p>
      </div>
    </section>

    <aside
      class="sticky top-5 overflow-hidden rounded-2xl border border-line bg-surface shadow-card max-[980px]:static max-[980px]:order-first"
    >
      <header class="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
        <h2 class="text-sm font-semibold">摘要结果</h2>
        <span class="text-[11px] text-ink-3">十六进制</span>
      </header>

      <div class="flex flex-col gap-3 px-5 pt-4 pb-5">
        <div
          v-for="algorithm in algorithms"
          :key="algorithm"
          class="rounded-xl border border-line bg-surface-2 px-3 py-2"
        >
          <div class="flex items-center justify-between">
            <span class="text-[11.5px] font-semibold text-ink-2">{{ algorithm }}</span>
            <button
              type="button"
              class="inline-flex items-center gap-1 text-[11px] text-ink-3 transition-colors hover:text-brand disabled:opacity-40"
              :disabled="!hashMap[algorithm]"
              @click="copy(hashMap[algorithm] ?? '', algorithm)"
            >
              <Copy :size="12" />
              复制
            </button>
          </div>
          <p
            class="mt-1 font-mono text-[11px] leading-[1.6] break-all"
            :class="hashMap[algorithm] ? 'text-ink-2' : 'text-ink-3'"
          >
            {{ hashMap[algorithm] ?? "等待输入…" }}
          </p>
        </div>

        <p class="rounded-lg bg-surface-2 px-3 py-2 text-[11px] leading-relaxed text-ink-3">
          MD5 不属于 Web Crypto 标准，已被认为不安全；用于校验时建议选择 SHA-256 及以上。
        </p>
      </div>
    </aside>
  </div>
</template>
