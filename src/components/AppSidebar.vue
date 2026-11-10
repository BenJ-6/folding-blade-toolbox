<script setup lang="ts">
import { FileDown, Home, Palette, QrCode, RefreshCw, Scaling } from "lucide-vue-next";
</script>

<template>
  <aside
    class="border-line bg-surface sticky top-0 flex h-screen w-[236px] shrink-0 flex-col border-r px-3.5 pt-5 pb-4"
  >
    <RouterLink v-slot="{ isExactActive, navigate }" to="/" custom>
      <button
        type="button"
        class="flex h-[38px] w-full items-center gap-2.5 rounded-[10px] px-2.5 text-left text-[13.5px] font-medium transition-colors"
        :class="
          isExactActive ? 'bg-brand-soft text-brand font-semibold' : 'text-ink-2 hover:bg-surface-2'
        "
        @click="navigate"
      >
        <Home :size="17" />
        首页
      </button>
    </RouterLink>

    <p class="text-ink-3 px-2.5 pt-3.5 pb-1.5 text-[11px] font-semibold tracking-[0.08em]">图片</p>

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

    <p class="text-ink-3 px-2.5 pt-3.5 pb-1.5 text-[11px] font-semibold tracking-[0.08em]">
      实用工具
    </p>

    <RouterLink v-slot="{ isActive, navigate }" to="/qrcode" custom>
      <button
        type="button"
        class="flex h-[38px] w-full items-center gap-2.5 rounded-[10px] px-2.5 text-left text-[13.5px] font-medium transition-colors"
        :class="
          isActive ? 'bg-brand-soft text-brand font-semibold' : 'text-ink-2 hover:bg-surface-2'
        "
        @click="navigate"
      >
        <QrCode :size="17" />
        二维码
      </button>
    </RouterLink>

    <RouterLink v-slot="{ isActive, navigate }" to="/color" custom>
      <button
        type="button"
        class="flex h-[38px] w-full items-center gap-2.5 rounded-[10px] px-2.5 text-left text-[13.5px] font-medium transition-colors"
        :class="
          isActive ? 'bg-brand-soft text-brand font-semibold' : 'text-ink-2 hover:bg-surface-2'
        "
        @click="navigate"
      >
        <Palette :size="17" />
        颜色工具
      </button>
    </RouterLink>

    <div class="border-line text-ink-3 mt-auto border-t px-2.5 pt-3.5 text-[11.5px]">v0.1.0</div>
  </aside>
</template>
