import { computed, reactive, ref, type Ref } from "vue";
import { isAcceptedImage, pickImages, readImageFile, type PickedFile } from "@/lib/files";
import { decodeImage } from "@/lib/image";
import { DEFAULT_OPTIONS, type ImageItem, type ProcessOptions } from "@/types";

let sequence = 0;

function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  sequence += 1;
  return `img-${Date.now()}-${sequence}`;
}

export interface AddSummary {
  added: number;
  skipped: number;
}

export interface ImageQueue {
  items: Ref<ImageItem[]>;
  selectedId: Ref<string | null>;
  selectedItem: Ref<ImageItem | null>;
  picking: Ref<boolean>;
  options: ProcessOptions;
  pick: () => Promise<AddSummary>;
  addFiles: (files: File[]) => Promise<AddSummary>;
  addPaths: (paths: string[]) => Promise<AddSummary>;
  select: (id: string) => void;
  remove: (id: string) => void;
  clear: () => void;
  resetOptions: () => void;
}

export function createImageQueue(): ImageQueue {
  const items = ref<ImageItem[]>([]);
  const selectedId = ref<string | null>(null);
  const picking = ref(false);
  const options = reactive<ProcessOptions>({ ...DEFAULT_OPTIONS });

  const selectedItem = computed(
    () => items.value.find((item) => item.id === selectedId.value) ?? null,
  );

  async function loadItem(item: ImageItem): Promise<void> {
    try {
      const blob = await readImageFile(item);
      item.url = URL.createObjectURL(blob);
      item.size = blob.size;
      const decoded = await decodeImage(blob);
      try {
        item.width = decoded.width;
        item.height = decoded.height;
      } finally {
        decoded.dispose();
      }
      if (!selectedId.value) {
        selectedId.value = item.id;
      }
    } catch (error) {
      item.status = "error";
      item.error = error instanceof Error ? error.message : "无法读取图片";
    }
  }

  async function addPicked(picked: PickedFile[]): Promise<AddSummary> {
    const accepted = picked.filter((item) => isAcceptedImage(item.name));
    const summary: AddSummary = { added: 0, skipped: picked.length - accepted.length };

    for (const pickedFile of accepted) {
      const item: ImageItem = {
        id: createId(),
        name: pickedFile.name,
        path: pickedFile.path,
        file: pickedFile.file,
        url: "",
        width: 0,
        height: 0,
        size: 0,
        status: "pending",
      };
      items.value.push(item);
      summary.added += 1;
      await loadItem(item);
    }

    return summary;
  }

  async function pick(): Promise<AddSummary> {
    if (picking.value) {
      return { added: 0, skipped: 0 };
    }
    picking.value = true;
    try {
      return await addPicked(await pickImages());
    } finally {
      picking.value = false;
    }
  }

  async function addFiles(files: File[]): Promise<AddSummary> {
    return addPicked(files.map((file) => ({ file, name: file.name })));
  }

  async function addPaths(paths: string[]): Promise<AddSummary> {
    return addPicked(paths.map((path) => ({ path, name: path.split(/[\\/]/).pop() ?? path })));
  }

  function select(id: string): void {
    selectedId.value = id;
  }

  function remove(id: string): void {
    const index = items.value.findIndex((item) => item.id === id);
    if (index === -1) {
      return;
    }

    const item = items.value[index];
    URL.revokeObjectURL(item.url);
    if (item.result) {
      URL.revokeObjectURL(item.result.url);
    }
    items.value.splice(index, 1);

    if (selectedId.value === id) {
      selectedId.value = items.value[index]?.id ?? items.value[index - 1]?.id ?? null;
    }
  }

  function clear(): void {
    for (const item of items.value) {
      URL.revokeObjectURL(item.url);
      if (item.result) {
        URL.revokeObjectURL(item.result.url);
      }
    }
    items.value = [];
    selectedId.value = null;
  }

  function resetOptions(): void {
    Object.assign(options, DEFAULT_OPTIONS);
  }

  return {
    items,
    selectedId,
    selectedItem,
    picking,
    options,
    pick,
    addFiles,
    addPaths,
    select,
    remove,
    clear,
    resetOptions,
  };
}
