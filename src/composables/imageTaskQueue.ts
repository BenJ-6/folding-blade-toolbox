import { computed, reactive, ref, type Ref } from "vue";
import { isAcceptedImage, pickImages, readImageFile, type PickedFile } from "@/lib/files";
import { decodeImage } from "@/lib/image";
import type { ImageItem } from "@/types";

let sequence = 0;

function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  sequence += 1;
  return `task-${Date.now()}-${sequence}`;
}

export interface TaskOutput {
  blob: Blob;
  mime: string;
  fileName: string;
}

export interface AddSummary {
  added: number;
  skipped: number;
}

export interface ImageTaskQueue {
  items: Ref<ImageItem[]>;
  selectedId: Ref<string | null>;
  selectedItem: Ref<ImageItem | null>;
  picking: Ref<boolean>;
  processing: Ref<boolean>;
  stale: Ref<boolean>;
  progress: Ref<{ done: number; total: number }>;
  pick: () => Promise<AddSummary>;
  addFiles: (files: File[]) => Promise<AddSummary>;
  addPaths: (paths: string[]) => Promise<AddSummary>;
  select: (id: string | null) => void;
  remove: (id: string) => void;
  clear: () => void;
  move: (id: string, offset: number) => void;
  markStale: (value?: boolean) => void;
  processAll: (run: (item: ImageItem) => Promise<TaskOutput>) => Promise<void>;
  cancelProcessing: () => void;
}

/** 通用图片任务队列：只负责收集、排序、展示与逐个执行，具体处理由调用方提供 */
export function createImageTaskQueue(): ImageTaskQueue {
  const items = ref<ImageItem[]>([]);
  const selectedId = ref<string | null>(null);
  const picking = ref(false);
  const processing = ref(false);
  const stale = ref(false);
  const progress = ref({ done: 0, total: 0 });
  let cancelRequested = false;

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
    stale.value = false;
  }

  function move(id: string, offset: number): void {
    if (processing.value) {
      return;
    }
    const index = items.value.findIndex((item) => item.id === id);
    const target = index + offset;
    if (index === -1 || target < 0 || target >= items.value.length) {
      return;
    }
    const [item] = items.value.splice(index, 1);
    items.value.splice(target, 0, item);
  }

  function markStale(value = true): void {
    stale.value = value;
  }

  function cancelProcessing(): void {
    if (processing.value) {
      cancelRequested = true;
    }
  }

  async function processAll(run: (item: ImageItem) => Promise<TaskOutput>): Promise<void> {
    if (processing.value || !items.value.length) {
      return;
    }

    processing.value = true;
    cancelRequested = false;
    stale.value = false;
    progress.value = { done: 0, total: items.value.length };

    for (const item of items.value) {
      if (cancelRequested) {
        break;
      }
      item.status = "processing";
      item.error = undefined;

      try {
        const output = await run(item);
        if (item.result) {
          URL.revokeObjectURL(item.result.url);
        }
        item.result = {
          blob: output.blob,
          url: URL.createObjectURL(output.blob),
          width: item.width,
          height: item.height,
          size: output.blob.size,
          mime: output.mime,
          fileName: output.fileName,
        };
        item.status = "done";
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
    cancelRequested = false;
  }

  return {
    items,
    selectedId,
    selectedItem,
    picking,
    processing,
    stale,
    progress,
    pick,
    addFiles,
    addPaths,
    select,
    remove,
    clear,
    move,
    markStale,
    processAll,
    cancelProcessing,
  };
}
