import { ref, watch } from "vue";

const STORAGE_KEY = "my-toolbox:recent-colors";
const MAX_ITEMS = 18;

function load(): string[] {
  if (typeof localStorage === "undefined") {
    return [];
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter((item): item is string => typeof item === "string" && /^#[0-9a-f]{6}$/i.test(item))
      .slice(0, MAX_ITEMS);
  } catch {
    return [];
  }
}

const recent = ref<string[]>(load());

watch(
  recent,
  (value) => {
    if (typeof localStorage === "undefined") {
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } catch {
      // 存储不可用时不影响使用
    }
  },
  { deep: true },
);

export function useRecentColors() {
  function add(hex: string): void {
    const value = hex.trim().toUpperCase();
    if (!/^#[0-9A-F]{6}$/.test(value)) {
      return;
    }
    recent.value = [value, ...recent.value.filter((item) => item !== value)].slice(0, MAX_ITEMS);
  }

  function clear(): void {
    recent.value = [];
  }

  return { recent, add, clear };
}
