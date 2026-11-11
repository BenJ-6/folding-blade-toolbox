<script setup lang="ts">
import { ArrowUpRight, FileDown, Palette, QrCode, RefreshCw, Scaling } from "lucide-vue-next";

const tools = [
  {
    to: "/compress",
    name: "图片压缩",
    description: "批量压缩 JPG、PNG、GIF，在画质与体积之间自由平衡。",
    icon: FileDown,
  },
  {
    to: "/resize",
    name: "调整图片大小",
    description: "按百分比、固定尺寸、最长边或裁剪批量调整图片尺寸。",
    icon: Scaling,
  },
  {
    to: "/convert",
    name: "格式转换",
    description: "JPG、PNG、GIF、SVG 互转，支持透明背景与矢量化。",
    icon: RefreshCw,
  },
  {
    to: "/qrcode",
    name: "二维码",
    description: "生成自定义样式二维码，或从图片与摄像头中识别。",
    icon: QrCode,
  },
  {
    to: "/color",
    name: "颜色工具",
    description: "调色盘、渐变生成、对比度检查与图片取色。",
    icon: Palette,
  },
];
</script>

<template>
  <section class="mx-auto w-full max-w-[1180px]">
    <header
      class="relative mb-5 overflow-hidden rounded-2xl border border-line bg-surface px-7 py-8 shadow-card"
    >
      <div
        class="pointer-events-none absolute -top-24 -right-16 size-[260px] rounded-full bg-brand-gradient opacity-[0.13] blur-2xl"
      />
      <div class="relative">
        <div class="mb-4 flex items-center gap-3">
          <img src="/toolbox-logo.svg" alt="" width="40" height="40" class="rounded-[10px]" />
          <div>
            <p class="text-[11px] font-semibold tracking-[0.1em] text-ink-3">本地工具集</p>
            <h1 class="text-[23px] font-bold tracking-[-0.02em]">折刀雀工具箱</h1>
          </div>
        </div>
        <p class="max-w-[560px] text-[13.5px] leading-[1.8] text-ink-2">
          一个持续扩展的多功能工具箱。所有处理都在本机完成，文件不会上传到任何服务器。
        </p>
        <span
          class="mt-5 inline-flex h-8 items-center gap-[7px] rounded-full border border-line bg-surface-2 px-3 text-xs text-ink-2"
        >
          <span
            class="size-[7px] rounded-full bg-success shadow-[0_0_0_3px_var(--color-success-soft)]"
          />
          本地处理 · 不上传
        </span>
      </div>
    </header>

    <p class="px-1 pb-2 text-[11px] font-semibold tracking-[0.08em] text-ink-3">全部工具</p>

    <div class="grid grid-cols-2 gap-4 max-[860px]:grid-cols-1">
      <RouterLink
        v-for="tool in tools"
        :key="tool.to"
        :to="tool.to"
        class="group flex items-start gap-4 rounded-xl border border-line bg-surface p-5 no-underline shadow-card transition-colors hover:border-line-strong hover:bg-surface-2"
      >
        <span
          class="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-brand-soft text-brand"
        >
          <component :is="tool.icon" :size="19" />
        </span>
        <span class="min-w-0 flex-1">
          <span class="mb-1 flex items-center gap-1.5 text-[14px] font-semibold text-ink">
            {{ tool.name }}
            <ArrowUpRight
              :size="14"
              class="text-ink-3 opacity-0 transition-opacity group-hover:opacity-100"
            />
          </span>
          <span class="block text-[12.5px] leading-[1.7] text-ink-3">{{ tool.description }}</span>
        </span>
      </RouterLink>
    </div>
  </section>
</template>
