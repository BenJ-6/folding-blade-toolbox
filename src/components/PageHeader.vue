<script setup lang="ts">
import LocalBadge from "@/components/LocalBadge.vue";

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
    <LocalBadge />
  </header>
</template>
