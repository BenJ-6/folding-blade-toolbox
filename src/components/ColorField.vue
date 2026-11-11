<script setup lang="ts">
import { ref, watch } from "vue";
import { parseColor } from "@/lib/color";

const props = defineProps<{
  modelValue: string;
  label?: string;
}>();

const emit = defineEmits<{ "update:modelValue": [value: string] }>();

const text = ref(props.modelValue.toUpperCase());
const invalid = ref(false);
let resetTimer: number | undefined;

watch(
  () => props.modelValue,
  (value) => {
    text.value = value.toUpperCase();
    invalid.value = false;
  },
);

function commit(): void {
  const parsed = parseColor(text.value);
  if (parsed) {
    const value = parsed.hex.toUpperCase();
    text.value = value;
    invalid.value = false;
    emit("update:modelValue", value);
    return;
  }

  text.value = props.modelValue.toUpperCase();
  invalid.value = true;
  window.clearTimeout(resetTimer);
  resetTimer = window.setTimeout(() => {
    invalid.value = false;
  }, 1400);
}

function onPick(event: Event): void {
  emit("update:modelValue", (event.target as HTMLInputElement).value.toUpperCase());
}
</script>

<template>
  <div
    class="flex h-9 items-center gap-2 rounded-[9px] border border-line bg-surface-2 px-2 transition-colors focus-within:border-brand focus-within:bg-surface"
    :class="invalid ? 'border-danger' : ''"
  >
    <label
      class="relative size-6 shrink-0 cursor-pointer overflow-hidden rounded-md border border-line"
      :style="{ backgroundColor: modelValue }"
      :title="`选择${label ?? '颜色'}`"
    >
      <input
        type="color"
        class="absolute inset-0 size-full cursor-pointer opacity-0"
        :value="modelValue"
        :aria-label="label ?? '颜色'"
        @input="onPick"
      />
    </label>
    <input
      v-model="text"
      type="text"
      spellcheck="false"
      class="w-full min-w-0 bg-transparent font-mono text-[12px] font-medium text-ink uppercase outline-none"
      :aria-label="`${label ?? '颜色'}色值`"
      @blur="commit"
      @keydown.enter.prevent="commit"
    />
  </div>
</template>
