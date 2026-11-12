<script setup lang="ts">
import { ref } from "vue";
import { Binary, Braces, Clock, Hash, KeyRound, Link2 } from "lucide-vue-next";
import PageHeader from "@/components/PageHeader.vue";
import Base64Tool from "@/components/dev/Base64Tool.vue";
import HashTool from "@/components/dev/HashTool.vue";
import JsonFormatter from "@/components/dev/JsonFormatter.vue";
import JwtInspector from "@/components/dev/JwtInspector.vue";
import TimestampTool from "@/components/dev/TimestampTool.vue";
import UrlCodec from "@/components/dev/UrlCodec.vue";
import { useToast } from "@/composables/useToast";

type DevTab = "jwt" | "json" | "base64" | "url" | "timestamp" | "hash";

const { message } = useToast();

const tab = ref<DevTab>("jwt");

const tabs = [
  { value: "jwt" as const, label: "JWT 解析", icon: KeyRound },
  { value: "json" as const, label: "JSON 格式化", icon: Braces },
  { value: "base64" as const, label: "Base64", icon: Binary },
  { value: "url" as const, label: "URL 编解码", icon: Link2 },
  { value: "timestamp" as const, label: "时间戳", icon: Clock },
  { value: "hash" as const, label: "哈希", icon: Hash },
];
</script>

<template>
  <section class="mx-auto w-full max-w-[1180px]">
    <PageHeader
      title="开发工具"
      description="JWT 解析、JSON 格式化、Base64 / URL 编解码、时间戳与哈希"
    />

    <div
      class="mb-4 flex flex-wrap items-center gap-1 rounded-xl border border-line bg-surface p-1 shadow-card"
    >
      <button
        v-for="item in tabs"
        :key="item.value"
        type="button"
        class="inline-flex h-9 items-center gap-2 rounded-lg px-3.5 text-[13px] transition-colors"
        :class="
          tab === item.value
            ? 'bg-brand-soft font-semibold text-brand'
            : 'font-medium text-ink-2 hover:bg-surface-2'
        "
        @click="tab = item.value"
      >
        <component :is="item.icon" :size="16" />
        {{ item.label }}
      </button>
    </div>

    <KeepAlive>
      <JwtInspector v-if="tab === 'jwt'" />
      <JsonFormatter v-else-if="tab === 'json'" />
      <Base64Tool v-else-if="tab === 'base64'" />
      <UrlCodec v-else-if="tab === 'url'" />
      <TimestampTool v-else-if="tab === 'timestamp'" />
      <HashTool v-else />
    </KeepAlive>

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
          v-if="message"
          class="pointer-events-none fixed bottom-8 left-1/2 z-50 -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-[12.5px] font-medium text-white shadow-lg"
        >
          {{ message }}
        </div>
      </Transition>
    </Teleport>
  </section>
</template>
