<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { CalendarClock, Clock, Copy, RefreshCw } from "lucide-vue-next";
import { useToast } from "@/composables/useToast";
import { copyText } from "@/lib/clipboard";
import { timestampInfo } from "@/lib/dev";

const { notify } = useToast();

const now = ref(Date.now());
let timer: number | undefined;

onMounted(() => {
  timer = window.setInterval(() => {
    now.value = Date.now();
  }, 1000);
});

onUnmounted(() => {
  window.clearInterval(timer);
});

const nowSeconds = computed(() => Math.floor(now.value / 1000));
const nowLocal = computed(() => new Date(now.value).toLocaleString("zh-CN", { hour12: false }));
const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

const unit = ref<"s" | "ms">("s");
const timestampInput = ref(String(Math.floor(Date.now() / 1000)));

const fromTimestamp = computed(() => {
  const raw = timestampInput.value.trim();
  if (!raw) {
    return { error: "", info: null };
  }
  const numeric = Number(raw);
  if (!Number.isFinite(numeric) || !/^-?\d+$/.test(raw)) {
    return { error: "请输入整数时间戳", info: null };
  }
  const ms = unit.value === "s" ? numeric * 1000 : numeric;
  if (ms < 0 || ms > 8.64e15) {
    return { error: "时间戳超出可表示的范围", info: null };
  }
  return { error: "", info: { ms, ...timestampInfo(ms, now.value) } };
});

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function toDateTimeInput(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

const dateInput = ref(toDateTimeInput(new Date()));

const fromDate = computed(() => {
  if (!dateInput.value) {
    return null;
  }
  const date = new Date(dateInput.value);
  const ms = date.getTime();
  if (!Number.isFinite(ms)) {
    return null;
  }
  return {
    seconds: Math.floor(ms / 1000),
    millis: ms,
    local: date.toLocaleString("zh-CN", { hour12: false }),
    utc: date.toUTCString(),
  };
});

const timestampRows = computed(() => {
  const info = fromTimestamp.value.info;
  if (!info) {
    return [];
  }
  return [
    { label: "本地时间", value: info.local },
    { label: "UTC 时间", value: info.utc },
    { label: "ISO 8601", value: info.iso },
    { label: "相对现在", value: info.relative },
  ];
});

const dateRows = computed(() => {
  const date = fromDate.value;
  if (!date) {
    return [];
  }
  return [
    { label: "秒级时间戳", value: String(date.seconds) },
    { label: "毫秒级时间戳", value: String(date.millis) },
    { label: "ISO 8601", value: new Date(date.millis).toISOString() },
  ];
});

function useNow(): void {
  const current = Date.now();
  timestampInput.value = unit.value === "s" ? String(Math.floor(current / 1000)) : String(current);
  dateInput.value = toDateTimeInput(new Date(current));
  notify("已填入当前时间");
}

function syncFromLive(): void {
  timestampInput.value = unit.value === "s" ? String(nowSeconds.value) : String(now.value);
  dateInput.value = toDateTimeInput(new Date(now.value));
}

async function copy(value: string | number, label: string): Promise<void> {
  const ok = await copyText(String(value));
  notify(ok ? `${label}已复制` : "复制失败，请重试");
}
</script>

<template>
  <div class="flex flex-col gap-5">
    <section class="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
      <header class="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
        <h2 class="flex items-center gap-2 text-sm font-semibold">
          <Clock :size="17" class="text-brand" />
          当前时间
        </h2>
        <button
          type="button"
          class="inline-flex items-center gap-1 text-[11.5px] text-ink-3 transition-colors hover:text-brand"
          @click="useNow"
        >
          <RefreshCw :size="13" />
          填入下面的转换器
        </button>
      </header>

      <div class="grid grid-cols-2 gap-3 px-5 pt-4 pb-5 max-[720px]:grid-cols-1">
        <div class="rounded-xl border border-line bg-surface-2 px-4 py-3">
          <div class="flex items-center justify-between">
            <p class="text-[11.5px] text-ink-3">秒级时间戳</p>
            <button
              type="button"
              class="inline-flex items-center gap-1 text-[11px] text-ink-3 transition-colors hover:text-brand"
              @click="copy(nowSeconds, '秒级时间戳')"
            >
              <Copy :size="12" />
              复制
            </button>
          </div>
          <p class="mt-1 font-mono text-[22px] leading-tight font-semibold tabular-nums">
            {{ nowSeconds }}
          </p>
        </div>

        <div class="rounded-xl border border-line bg-surface-2 px-4 py-3">
          <div class="flex items-center justify-between">
            <p class="text-[11.5px] text-ink-3">毫秒级时间戳</p>
            <button
              type="button"
              class="inline-flex items-center gap-1 text-[11px] text-ink-3 transition-colors hover:text-brand"
              @click="copy(now, '毫秒级时间戳')"
            >
              <Copy :size="12" />
              复制
            </button>
          </div>
          <p class="mt-1 font-mono text-[22px] leading-tight font-semibold tabular-nums">
            {{ now }}
          </p>
        </div>

        <p class="col-span-2 text-[11.5px] text-ink-3 max-[720px]:col-span-1">
          本地时间 {{ nowLocal }} · 时区 {{ timeZone }}
        </p>
      </div>
    </section>

    <div class="grid grid-cols-2 items-start gap-5 max-[980px]:grid-cols-1">
      <section class="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
        <header class="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 class="flex items-center gap-2 text-sm font-semibold">
            <Clock :size="16" class="text-brand" />
            时间戳 → 日期
          </h2>
          <div class="flex items-center gap-1 rounded-lg bg-surface-2 p-1">
            <button
              type="button"
              class="inline-flex h-7 items-center rounded-md px-2 text-[11.5px] transition-colors"
              :class="
                unit === 's'
                  ? 'bg-surface font-semibold text-brand shadow-card'
                  : 'font-medium text-ink-2 hover:text-ink'
              "
              @click="unit = 's'"
            >
              秒
            </button>
            <button
              type="button"
              class="inline-flex h-7 items-center rounded-md px-2 text-[11.5px] transition-colors"
              :class="
                unit === 'ms'
                  ? 'bg-surface font-semibold text-brand shadow-card'
                  : 'font-medium text-ink-2 hover:text-ink'
              "
              @click="unit = 'ms'"
            >
              毫秒
            </button>
          </div>
        </header>

        <div class="flex flex-col gap-3 px-5 pt-4 pb-5">
          <input
            v-model="timestampInput"
            type="text"
            inputmode="numeric"
            spellcheck="false"
            class="field font-mono tabular-nums"
            placeholder="例如 1710000000"
          />

          <p v-if="fromTimestamp.error" class="text-[11.5px] text-danger">
            {{ fromTimestamp.error }}
          </p>

          <div v-if="fromTimestamp.info" class="flex flex-col gap-2.5">
            <div
              v-for="row in timestampRows"
              :key="row.label"
              class="flex items-start justify-between gap-3 rounded-lg border border-line bg-surface-2 px-3 py-2"
            >
              <div class="min-w-0">
                <p class="text-[10.5px] text-ink-3">{{ row.label }}</p>
                <p class="mt-0.5 font-mono text-[11.5px] font-medium break-all text-ink-2">
                  {{ row.value }}
                </p>
              </div>
              <button
                type="button"
                class="mt-0.5 grid size-7 shrink-0 place-items-center rounded-md text-ink-3 transition-colors hover:bg-surface-3 hover:text-brand"
                :title="`复制${row.label}`"
                @click="copy(row.value, row.label)"
              >
                <Copy :size="13" />
              </button>
            </div>
          </div>
          <p v-else-if="!fromTimestamp.error" class="text-[11.5px] text-ink-3">
            输入时间戳后显示对应日期
          </p>
        </div>
      </section>

      <section class="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
        <header class="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 class="flex items-center gap-2 text-sm font-semibold">
            <CalendarClock :size="16" class="text-brand" />
            日期 → 时间戳
          </h2>
          <button
            type="button"
            class="inline-flex items-center gap-1 text-[11.5px] text-ink-3 transition-colors hover:text-brand"
            @click="syncFromLive"
          >
            <RefreshCw :size="13" />
            现在
          </button>
        </header>

        <div class="flex flex-col gap-3 px-5 pt-4 pb-5">
          <input v-model="dateInput" type="datetime-local" step="1" class="field" />

          <div v-if="fromDate" class="flex flex-col gap-2.5">
            <div
              v-for="row in dateRows"
              :key="row.label"
              class="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface-2 px-3 py-2"
            >
              <div class="min-w-0">
                <p class="text-[10.5px] text-ink-3">{{ row.label }}</p>
                <p
                  class="mt-0.5 font-mono text-[11.5px] font-medium break-all text-ink-2 tabular-nums"
                >
                  {{ row.value }}
                </p>
              </div>
              <button
                type="button"
                class="grid size-7 shrink-0 place-items-center rounded-md text-ink-3 transition-colors hover:bg-surface-3 hover:text-brand"
                :title="`复制${row.label}`"
                @click="copy(row.value, row.label)"
              >
                <Copy :size="13" />
              </button>
            </div>
          </div>
          <p v-else class="text-[11.5px] text-ink-3">选择一个日期时间后显示对应时间戳</p>

          <p class="text-[11px] leading-relaxed text-ink-3">
            转换按当前系统时区 {{ timeZone }} 进行
          </p>
        </div>
      </section>
    </div>
  </div>
</template>
