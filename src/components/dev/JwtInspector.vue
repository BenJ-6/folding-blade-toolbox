<script setup lang="ts">
import { computed, ref } from "vue";
import { CircleCheck, Copy, KeyRound, Trash2, TriangleAlert, Wand2 } from "lucide-vue-next";
import { useToast } from "@/composables/useToast";
import { copyText } from "@/lib/clipboard";
import { decodeJwt, encodeBase64, jwtSeconds, relativeTime } from "@/lib/dev";

const { notify } = useToast();

const token = ref("");

const parsed = computed(() => {
  const raw = token.value.trim();
  if (!raw) {
    return null;
  }
  try {
    return { data: decodeJwt(raw), error: "" };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : "无法解析这个令牌",
    };
  }
});

const jwt = computed(() => parsed.value?.data ?? null);
const error = computed(() => parsed.value?.error ?? "");

function claimText(value: unknown): string {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => claimText(item)).join(", ");
  }
  return "—";
}

function claimTime(value: unknown): string {
  const ms = jwtSeconds(value);
  return ms ? new Date(ms).toLocaleString("zh-CN", { hour12: false }) : "—";
}

const infoRows = computed(() => [
  { label: "算法 alg", value: claimText(jwt.value?.header.alg) },
  { label: "类型 typ", value: claimText(jwt.value?.header.typ) },
  { label: "签发时间 iat", value: claimTime(jwt.value?.payload.iat) },
  { label: "生效时间 nbf", value: claimTime(jwt.value?.payload.nbf) },
  { label: "过期时间 exp", value: claimTime(jwt.value?.payload.exp) },
  { label: "签发者 iss", value: claimText(jwt.value?.payload.iss) },
  { label: "主体 sub", value: claimText(jwt.value?.payload.sub) },
  { label: "受众 aud", value: claimText(jwt.value?.payload.aud) },
  { label: "签名段", value: jwt.value?.signature ? "存在（未校验）" : "无" },
]);

const status = computed(() => {
  if (!token.value.trim()) {
    return { label: "等待输入", tone: "neutral" as const };
  }
  if (error.value) {
    return { label: "无法解析", tone: "danger" as const };
  }
  const exp = jwtSeconds(jwt.value?.payload.exp);
  if (exp && exp <= Date.now()) {
    return { label: "已过期", tone: "danger" as const };
  }
  const nbf = jwtSeconds(jwt.value?.payload.nbf);
  if (nbf && nbf > Date.now()) {
    return { label: "尚未生效", tone: "warning" as const };
  }
  return { label: "解析成功", tone: "success" as const };
});

const expired = computed(() => {
  const exp = jwtSeconds(jwt.value?.payload.exp);
  return Boolean(exp && exp <= Date.now());
});

const expiryHint = computed(() => {
  const exp = jwtSeconds(jwt.value?.payload.exp);
  if (!exp) {
    return "";
  }
  return expired.value ? `已过期（${relativeTime(exp)}）` : `${relativeTime(exp)}过期`;
});

const badgeClass = computed(() => {
  if (status.value.tone === "success") {
    return "bg-success-soft text-success";
  }
  if (status.value.tone === "danger") {
    return "bg-[#fdecec] text-danger";
  }
  if (status.value.tone === "warning") {
    return "bg-[#fff8e6] text-[#a16207]";
  }
  return "bg-surface-3 text-ink-2";
});

function loadSample(): void {
  const now = Math.floor(Date.now() / 1000);
  token.value = [
    encodeBase64(JSON.stringify({ alg: "HS256", typ: "JWT" }), true),
    encodeBase64(
      JSON.stringify({
        sub: "1234567890",
        name: "折刀雀",
        role: "admin",
        iat: now,
        exp: now + 3600,
      }),
      true,
    ),
    encodeBase64("demo-signature", true),
  ].join(".");
  notify("已填入示例令牌");
}

function clear(): void {
  token.value = "";
}

async function copy(value: string, label: string): Promise<void> {
  if (!value) {
    return;
  }
  const ok = await copyText(value);
  notify(ok ? `${label}已复制` : "复制失败，请重试");
}
</script>

<template>
  <div class="grid grid-cols-[minmax(0,1fr)_336px] items-start gap-5 max-[980px]:grid-cols-1">
    <div class="flex min-w-0 flex-col gap-4">
      <section class="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
        <header class="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 class="flex items-center gap-2 text-sm font-semibold">
            <KeyRound :size="17" class="text-brand" />
            JWT 令牌
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
              :disabled="!token"
              @click="clear"
            >
              <Trash2 :size="13" />
              清空
            </button>
          </div>
        </header>

        <div class="flex flex-col gap-2 px-5 pt-4 pb-5">
          <textarea
            v-model="token"
            rows="5"
            spellcheck="false"
            class="w-full resize-y rounded-[9px] border border-line bg-surface-2 px-3 py-2.5 font-mono text-[11.5px] leading-[1.7] break-all transition-colors outline-none focus:border-brand focus:bg-surface focus:shadow-[0_0_0_3px_var(--color-brand-soft)]"
            placeholder="粘贴 JWT，例如 eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.…"
          />
          <p
            v-if="error"
            class="flex items-start gap-1.5 text-[11.5px] leading-relaxed text-danger"
          >
            <TriangleAlert :size="13" class="mt-0.5 shrink-0" />
            {{ error }}
          </p>
          <p v-else class="text-[11.5px] leading-relaxed text-ink-3">
            支持带
            <span class="font-mono">Bearer</span> 前缀的令牌，解析在本地完成，不会发送到任何服务器
          </p>
        </div>
      </section>

      <section class="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
        <header class="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 class="text-sm font-semibold">Header · 头部</h2>
          <button
            type="button"
            class="inline-flex items-center gap-1 text-[11.5px] text-ink-3 transition-colors hover:text-brand disabled:opacity-40"
            :disabled="!jwt"
            @click="copy(jwt?.headerJson ?? '', '头部')"
          >
            <Copy :size="13" />
            复制
          </button>
        </header>
        <div class="px-5 pt-4 pb-5">
          <pre
            class="max-h-[260px] overflow-auto rounded-[9px] bg-surface-2 p-3 font-mono text-[11.5px] leading-[1.7] break-words whitespace-pre-wrap text-ink-2"
            >{{ jwt?.headerJson || "// 等待解析" }}</pre>
        </div>
      </section>

      <section class="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
        <header class="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 class="text-sm font-semibold">Payload · 载荷</h2>
          <button
            type="button"
            class="inline-flex items-center gap-1 text-[11.5px] text-ink-3 transition-colors hover:text-brand disabled:opacity-40"
            :disabled="!jwt"
            @click="copy(jwt?.payloadJson ?? '', '载荷')"
          >
            <Copy :size="13" />
            复制
          </button>
        </header>
        <div class="px-5 pt-4 pb-5">
          <pre
            class="max-h-[360px] overflow-auto rounded-[9px] bg-surface-2 p-3 font-mono text-[11.5px] leading-[1.7] break-words whitespace-pre-wrap text-ink-2"
            >{{ jwt?.payloadJson || "// 等待解析" }}</pre>
        </div>
      </section>
    </div>

    <aside
      class="sticky top-5 overflow-hidden rounded-2xl border border-line bg-surface shadow-card max-[980px]:static max-[980px]:order-first"
    >
      <header class="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
        <h2 class="text-sm font-semibold">令牌信息</h2>
        <span class="rounded-md px-2 py-0.5 text-[11px] font-semibold" :class="badgeClass">
          {{ status.label }}
        </span>
      </header>

      <div class="flex flex-col gap-4 px-5 pt-4 pb-5">
        <div class="flex flex-col gap-2.5">
          <div
            v-for="row in infoRows"
            :key="row.label"
            class="flex items-start justify-between gap-3 border-b border-line pb-2 last:border-none last:pb-0"
          >
            <span class="shrink-0 text-[11.5px] text-ink-3">{{ row.label }}</span>
            <span class="min-w-0 text-right text-[11.5px] font-medium break-words text-ink-2">
              {{ row.value }}
            </span>
          </div>
        </div>

        <p
          v-if="expiryHint"
          class="flex items-start gap-1.5 rounded-lg px-3 py-2 text-[11.5px] leading-relaxed"
          :class="expired ? 'bg-[#fdecec] text-danger' : 'bg-success-soft text-success'"
        >
          <TriangleAlert v-if="expired" :size="13" class="mt-0.5 shrink-0" />
          <CircleCheck v-else :size="13" class="mt-0.5 shrink-0" />
          {{ expiryHint }}
        </p>

        <button
          type="button"
          class="inline-flex h-9 items-center justify-center gap-1.5 rounded-[9px] border border-line bg-surface text-[12px] font-medium text-ink-2 transition-colors hover:border-line-strong hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
          :disabled="!jwt"
          @click="copy(jwt?.payloadJson ?? '', '载荷')"
        >
          <Copy :size="13" />
          复制载荷 JSON
        </button>

        <p class="rounded-lg bg-surface-2 px-3 py-2 text-[11px] leading-relaxed text-ink-3">
          这里只做解码展示，不校验签名。令牌是否可信，需要在服务端用密钥或公钥验证。
        </p>
      </div>
    </aside>
  </div>
</template>
