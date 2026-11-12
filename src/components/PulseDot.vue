<script setup lang="ts">
import { computed } from "vue";

defineOptions({ name: "PulseDot" });

const props = withDefaults(
  defineProps<{
    /** 圆点颜色，默认取语义色 success */
    color?: string;
    /** 圆点直径（px） */
    size?: number;
    /** 是否播放波纹动画，需要强调「活性」时开启 */
    animated?: boolean;
  }>(),
  { color: "var(--color-success)", size: 6, animated: true },
);

/** 颜色通过 style 的 color 下发，圆点与波纹统一使用 currentColor */
const dotStyle = computed(() => ({
  color: props.color,
  width: `${props.size}px`,
  height: `${props.size}px`,
}));
</script>

<template>
  <span
    class="pulse-dot"
    :class="{ 'pulse-dot--animated': animated }"
    :style="dotStyle"
    aria-hidden="true"
  />
</template>

<style scoped>
/*
 * 状态圆点：本体常亮，开启 animated 时叠加一圈同色波纹向外扩散淡出。
 * 只动 transform 与 opacity，不触发布局。
 */
.pulse-dot {
  position: relative;
  display: block;
  flex-shrink: 0;
  border-radius: 50%;
  background: currentColor;
}

.pulse-dot--animated::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: currentColor;
  animation: pulse-dot-wave 2.2s ease-out infinite;
}

@keyframes pulse-dot-wave {
  0% {
    opacity: 0.5;
    transform: scale(1);
  }
  70%,
  100% {
    opacity: 0;
    transform: scale(2.2);
  }
}

/* 系统开启「减少动态效果」时只留静态圆点 */
@media (prefers-reduced-motion: reduce) {
  .pulse-dot--animated::after {
    animation: none;
    opacity: 0;
  }
}
</style>
