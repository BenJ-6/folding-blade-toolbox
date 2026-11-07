<script setup lang="ts">
import AppSidebar from "@/components/AppSidebar.vue";
</script>

<template>
  <div class="bg-page flex min-h-screen">
    <AppSidebar />
    <main class="min-w-0 flex-1 px-7 pt-6 pb-10">
      <RouterView />
    </main>
  </div>
</template>
