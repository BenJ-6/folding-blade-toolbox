<script setup lang="ts">
import { onMounted } from "vue";
import AppSidebar from "@/components/AppSidebar.vue";
import { isTauri } from "@/lib/backend";
import { useUpdate } from "@/lib/update";

const { checkForUpdate } = useUpdate();

onMounted(() => {
  if (!isTauri()) {
    return;
  }
  // 启动后静默检查一次，仅在侧边栏“关于”按钮上打一个提示点
  window.setTimeout(() => {
    void checkForUpdate({ silent: true });
  }, 4000);
});
</script>

<template>
  <div class="flex min-h-screen bg-page">
    <AppSidebar />
    <main class="min-w-0 flex-1 px-7 pt-6 pb-10">
      <RouterView />
    </main>
  </div>
</template>
