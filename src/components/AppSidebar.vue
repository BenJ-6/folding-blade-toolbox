<script setup lang="ts">
import {
  AppWindow,
  Droplets,
  FileDown,
  FileText,
  Home,
  Images,
  Palette,
  QrCode,
  RefreshCw,
  Scaling,
  ScanSearch,
  Terminal,
} from "lucide-vue-next";

const groups = [
  {
    label: "图片",
    items: [
      { to: "/compress", label: "图片压缩", icon: FileDown },
      { to: "/resize", label: "调整图片大小", icon: Scaling },
      { to: "/convert", label: "格式转换", icon: RefreshCw },
      { to: "/watermark", label: "批量加水印", icon: Droplets },
      { to: "/pdf", label: "图片转 PDF", icon: FileText },
      { to: "/stitch", label: "长图拼接", icon: Images },
      { to: "/metadata", label: "图片信息", icon: ScanSearch },
    ],
  },
  {
    label: "实用工具",
    items: [
      { to: "/qrcode", label: "二维码", icon: QrCode },
      { to: "/color", label: "颜色工具", icon: Palette },
      { to: "/icon", label: "图标提取", icon: AppWindow },
    ],
  },
  {
    label: "开发",
    items: [{ to: "/devtools", label: "开发工具", icon: Terminal }],
  },
];
</script>

<template>
  <aside
    class="sticky top-0 flex h-screen w-[236px] shrink-0 flex-col overflow-y-auto border-r border-line bg-surface px-3.5 pt-5 pb-4"
  >
    <RouterLink v-slot="{ isExactActive, navigate }" to="/" custom>
      <button
        type="button"
        class="flex h-[38px] w-full items-center gap-2.5 rounded-[10px] px-2.5 text-left text-[13.5px] font-medium transition-colors"
        :class="
          isExactActive ? 'bg-brand-soft font-semibold text-brand' : 'text-ink-2 hover:bg-surface-2'
        "
        @click="navigate"
      >
        <Home :size="17" />
        首页
      </button>
    </RouterLink>

    <template v-for="group in groups" :key="group.label">
      <p class="px-2.5 pt-3.5 pb-1.5 text-[11px] font-semibold tracking-[0.08em] text-ink-3">
        {{ group.label }}
      </p>

      <RouterLink
        v-for="item in group.items"
        :key="item.to"
        v-slot="{ isActive, navigate }"
        :to="item.to"
        custom
      >
        <button
          type="button"
          class="flex h-[38px] w-full items-center gap-2.5 rounded-[10px] px-2.5 text-left text-[13.5px] font-medium transition-colors"
          :class="
            isActive ? 'bg-brand-soft font-semibold text-brand' : 'text-ink-2 hover:bg-surface-2'
          "
          @click="navigate"
        >
          <component :is="item.icon" :size="17" />
          {{ item.label }}
        </button>
      </RouterLink>
    </template>

    <div class="mt-auto border-t border-line px-2.5 pt-3.5 text-[11.5px] text-ink-3">v0.1.0</div>
  </aside>
</template>
