<script setup lang="ts">
import { Check, Layers } from "lucide-vue-next";

const checks = [
  "Tauri 2 + Vue 3 + TypeScript 脚手架",
  "Tailwind CSS 4 与 @theme 设计变量",
  "Lucide 图标库",
  "Dialog / FS 插件与 capabilities 权限",
  "Vite 别名与 ESLint / Prettier",
];
</script>

<template>
  <main class="bg-page grid min-h-screen place-items-center p-8">
    <section
      class="w-full max-w-[420px] rounded-[18px] border border-line bg-surface px-8 pt-[30px] pb-7 shadow-float"
    >
      <span
        class="mb-5 inline-block rounded-full bg-brand-soft px-2.5 py-1 text-[11.5px] font-semibold text-brand"
      >
        阶段 0 · 工程基线
      </span>
      <div
        class="bg-brand-gradient mb-3.5 grid size-[42px] place-items-center rounded-xl text-white shadow-[0_10px_20px_-10px_rgba(99,102,241,0.7)]"
      >
        <Layers :size="22" :stroke-width="1.8" />
      </div>
      <h1 class="mb-1.5 text-[20px] font-bold tracking-[-0.02em]">Toolbox 已就绪</h1>
      <p class="mb-5 text-[13px] leading-[1.7] text-ink-3">
        工程配置搭建完成，图片压缩与尺寸调整界面将在下一阶段实现。
      </p>
      <ul class="flex flex-col gap-2.5 border-t border-line pt-4 text-[12.5px] text-ink-2">
        <li v-for="item in checks" :key="item" class="flex items-center gap-2">
          <span class="grid size-[18px] place-items-center rounded-md bg-success-soft text-success">
            <Check :size="13" :stroke-width="2" />
          </span>
          {{ item }}
        </li>
      </ul>
    </section>
  </main>
</template>
