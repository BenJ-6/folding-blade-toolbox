<script setup lang="ts">
import {
  FileDown,
  FileText,
  Palette,
  QrCode,
  RefreshCw,
  Scaling,
  TextCursorInput,
} from "lucide-vue-next";
</script>

<template>
  <aside
    class="border-line bg-surface sticky top-0 flex h-screen w-[236px] shrink-0 flex-col border-r px-3.5 pt-5 pb-4"
  >
    <div class="flex items-center gap-3 px-2 pb-5">
      <img
        src="/toolbox-logo.svg"
        alt=""
        width="34"
        height="34"
        class="shrink-0 rounded-[8px] shadow-[0_8px_16px_-8px_rgba(23,78,64,0.65)]"
      />
      <div>
        <p class="text-[15px] font-semibold tracking-[-0.01em]">折刀雀工具箱</p>
        <p class="text-ink-3 text-[11.5px]">本地工具集</p>
      </div>
    </div>

    <p class="text-ink-3 px-2.5 pt-3.5 pb-1.5 text-[11px] font-semibold tracking-[0.08em]">
      图片工具
    </p>

    <RouterLink v-slot="{ isActive, navigate }" to="/compress" custom>
      <button
        type="button"
        class="flex h-[38px] w-full items-center gap-2.5 rounded-[10px] px-2.5 text-left text-[13.5px] font-medium transition-colors"
        :class="
          isActive ? 'bg-brand-soft text-brand font-semibold' : 'text-ink-2 hover:bg-surface-2'
        "
        @click="navigate"
      >
        <FileDown :size="17" />
        图片压缩
      </button>
    </RouterLink>

    <RouterLink v-slot="{ isActive, navigate }" to="/resize" custom>
      <button
        type="button"
        class="flex h-[38px] w-full items-center gap-2.5 rounded-[10px] px-2.5 text-left text-[13.5px] font-medium transition-colors"
        :class="
          isActive ? 'bg-brand-soft text-brand font-semibold' : 'text-ink-2 hover:bg-surface-2'
        "
        @click="navigate"
      >
        <Scaling :size="17" />
        调整图片大小
      </button>
    </RouterLink>

    <RouterLink v-slot="{ isActive, navigate }" to="/convert" custom>
      <button
        type="button"
        class="flex h-[38px] w-full items-center gap-2.5 rounded-[10px] px-2.5 text-left text-[13.5px] font-medium transition-colors"
        :class="
          isActive ? 'bg-brand-soft text-brand font-semibold' : 'text-ink-2 hover:bg-surface-2'
        "
        @click="navigate"
      >
        <RefreshCw :size="17" />
        格式转换
      </button>
    </RouterLink>

    <div
      class="text-ink-3 flex h-[38px] items-center gap-2.5 rounded-[10px] px-2.5 text-[13.5px] font-medium"
    >
      <TextCursorInput :size="17" />
      <span>批量重命名</span>
      <span class="bg-surface-3 ml-auto rounded-[5px] px-1.5 py-0.5 text-[10.5px] font-medium">
        即将
      </span>
    </div>

    <p class="text-ink-3 px-2.5 pt-3.5 pb-1.5 text-[11px] font-semibold tracking-[0.08em]">
      更多工具
    </p>

    <div
      class="text-ink-3 flex h-[38px] items-center gap-2.5 rounded-[10px] px-2.5 text-[13.5px] font-medium"
    >
      <FileText :size="17" />
      <span>PDF 处理</span>
      <span class="bg-surface-3 ml-auto rounded-[5px] px-1.5 py-0.5 text-[10.5px] font-medium">
        即将
      </span>
    </div>

    <div
      class="text-ink-3 flex h-[38px] items-center gap-2.5 rounded-[10px] px-2.5 text-[13.5px] font-medium"
    >
      <QrCode :size="17" />
      <span>二维码</span>
      <span class="bg-surface-3 ml-auto rounded-[5px] px-1.5 py-0.5 text-[10.5px] font-medium">
        即将
      </span>
    </div>

    <div
      class="text-ink-3 flex h-[38px] items-center gap-2.5 rounded-[10px] px-2.5 text-[13.5px] font-medium"
    >
      <Palette :size="17" />
      <span>颜色工具</span>
      <span class="bg-surface-3 ml-auto rounded-[5px] px-1.5 py-0.5 text-[10.5px] font-medium">
        即将
      </span>
    </div>

    <div class="border-line text-ink-3 mt-auto border-t px-2.5 pt-3.5 text-[11.5px] leading-[1.7]">
      <p class="text-ink-2 font-semibold">v0.1.0 · 预览版</p>
      <p>菜单骨架 · 功能待实现</p>
    </div>
  </aside>
</template>
