<script setup lang="ts">
defineProps<{
  title: string;
  description: string;
}>();
</script>

<template>
  <header class="mb-5 flex items-start justify-between gap-5">
    <div>
      <h1 class="mb-1.5 text-[21px] font-bold tracking-[-0.02em]">{{ title }}</h1>
      <p class="text-[13px] text-ink-3">{{ description }}</p>
    </div>
    <span
      class="inline-flex h-8 shrink-0 items-center gap-[7px] rounded-full border border-line bg-surface px-3 text-xs text-ink-2 shadow-card"
    >
      <span
        class="size-[7px] rounded-full bg-success shadow-[0_0_0_3px_var(--color-success-soft)]"
      />
      本地处理 · 不上传
    </span>
  </header>
</template>
