import { computed, reactive, ref, watch, type Ref } from "vue";
import { isTauri, makeOutputName, processWithRust, resolveOutputMime } from "@/lib/backend";
import { processWithCanvas } from "@/lib/canvasProcess";
import {
  guessMime,
  isAcceptedImage,
  pickImages,
  readImageFile,
  type PickedFile,
} from "@/lib/files";
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
  processing: Ref<boolean>;
  stale: Ref<boolean>;
  progress: Ref<{ done: number; total: number }>;
  options: ProcessOptions;
  pick: () => Promise<AddSummary>;
  addFiles: (files: File[]) => Promise<AddSummary>;
  addPaths: (paths: string[]) => Promise<AddSummary>;
  select: (id: string | null) => void;
  remove: (id: string) => void;
  clear: () => void;
  resetOptions: () => void;
  processAll: () => Promise<void>;
  cancelProcessing: () => void;
}

export function createImageQueue(overrides: Partial<ProcessOptions> = {}): ImageQueue {
  const items = ref<ImageItem[]>([]);
  const selectedId = ref<string | null>(null);
  const picking = ref(false);
  const processing = ref(false);
  const stale = ref(false);
  const progress = ref({ done: 0, total: 0 });
  const defaults: ProcessOptions = { ...DEFAULT_OPTIONS, ...overrides };
  const options = reactive<ProcessOptions>({ ...defaults });
  let cancelRequested = false;
  let staleAfterRun = false;

  watch(
    options,
    () => {
      if (processing.value) {
        staleAfterRun = true;
        return;
      }
      if (items.value.some((item) => item.result)) {
        stale.value = true;
      }
    },
    { deep: true },
  );

  const selectedItem = computed(
    () => items.value.find((item) => item.id === selectedId.value) ?? null,
  );

  async function loadItem(item: ImageItem): Promise<void> {
    try {
      const blob = await readImageFile(item);
      item.blob = blob;
      item.url = URL.createObjectURL(blob);
      item.size = blob.size;
      const decoded = await decodeImage(blob);
      try {
        item.width = decoded.width;
        item.height = decoded.height;
      } finally {
        decoded.dispose();
      }
    } catch (error) {
      item.status = "error";
      item.error = error instanceof Error ? error.message : "无法读取图片";
    }
  }

  async function addPicked(picked: PickedFile[]): Promise<AddSummary> {
    if (processing.value) {
      return { added: 0, skipped: picked.length };
    }

    const accepted = picked.filter((item) => isAcceptedImage(item.name));
    const summary: AddSummary = { added: 0, skipped: picked.length - accepted.length };
    const added: ImageItem[] = [];

    for (const pickedFile of accepted) {
      const item = reactive<ImageItem>({
        id: createId(),
        name: pickedFile.name,
        path: pickedFile.path,
        file: pickedFile.file,
        url: "",
        width: 0,
        height: 0,
        size: 0,
        status: "pending",
      });
      items.value.push(item);
      added.push(item);
    }

    summary.added = added.length;
    await Promise.all(added.map((item) => loadItem(item)));

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

  function select(id: string | null): void {
    selectedId.value = id;
  }

  function remove(id: string): void {
    if (processing.value) {
      return;
    }
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
      selectedId.value = null;
    }
  }

  function clear(): void {
    if (processing.value) {
      return;
    }
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
    Object.assign(options, defaults);
  }

  async function processItem(
    item: ImageItem,
    runOptions: ProcessOptions,
  ): Promise<{ blob: Blob; mime: string; fileName: string }> {
    const sourceMime = guessMime(item.name);
    const mime = resolveOutputMime(sourceMime, runOptions.targetFormat);
    const fileName = makeOutputName(item.name, runOptions.suffix, mime);

    if (item.path && isTauri()) {
      return { blob: await processWithRust(item.path, runOptions, sourceMime), mime, fileName };
    }
    if (item.blob) {
      return { blob: await processWithCanvas(item.blob, runOptions, sourceMime), mime, fileName };
    }
    throw new Error("缺少图片数据");
  }

  function cancelProcessing(): void {
    if (processing.value) {
      cancelRequested = true;
    }
  }

  async function processAll(): Promise<void> {
    if (processing.value || !items.value.length) {
      return;
    }

    const runOptions: ProcessOptions = { ...options };
    const processedIds = new Set<string>();
    processing.value = true;
    cancelRequested = false;
    staleAfterRun = false;
    stale.value = true;
    progress.value = { done: 0, total: items.value.length };

    for (const item of items.value) {
      if (cancelRequested) {
        break;
      }
      if (!item.path && !item.blob) {
        progress.value.done += 1;
        continue;
      }

      item.status = "processing";
      item.error = undefined;

      try {
        const processed = await processItem(item, runOptions);
        if (item.result) {
          URL.revokeObjectURL(item.result.url);
        }

        let width = item.width;
        let height = item.height;
        try {
          const decoded = await decodeImage(processed.blob);
          width = decoded.width;
          height = decoded.height;
          decoded.dispose();
        } catch {
          // 尺寸解析失败时保留目标尺寸的近似值
        }

        item.result = {
          blob: processed.blob,
          url: URL.createObjectURL(processed.blob),
          width,
          height,
          size: processed.blob.size,
          mime: processed.mime,
          fileName: processed.fileName,
        };
        item.status = "done";
        processedIds.add(item.id);
      } catch (error) {
        item.status = "error";
        item.error = error instanceof Error ? error.message : "处理失败";
      }

      progress.value.done += 1;
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    }

    if (cancelRequested) {
      for (const item of items.value) {
        if (item.status === "processing") {
          item.status = "pending";
        }
      }
    }

    processing.value = false;
    stale.value = cancelRequested
      ? items.value.some((item) => item.result && !processedIds.has(item.id))
      : staleAfterRun;
    cancelRequested = false;
    staleAfterRun = false;
  }

  return {
    items,
    selectedId,
    selectedItem,
    picking,
    processing,
    stale,
    progress,
    options,
    pick,
    addFiles,
    addPaths,
    select,
    remove,
    clear,
    resetOptions,
    processAll,
    cancelProcessing,
  };
}
