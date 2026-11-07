import { onMounted, onUnmounted, ref } from "vue";
import { getCurrentWebview } from "@tauri-apps/api/webview";

interface FileDropHandlers {
  onPaths: (paths: string[]) => void;
  onFiles: (files: File[]) => void;
}

function inTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function useFileDrop(handlers: FileDropHandlers) {
  const dragActive = ref(false);
  let unlisten: (() => void) | undefined;
  let disposed = false;

  const hasFiles = (event: DragEvent): boolean =>
    event.dataTransfer?.types.includes("Files") ?? false;

  const onDragEnter = (event: DragEvent): void => {
    event.preventDefault();
    if (hasFiles(event)) {
      dragActive.value = true;
    }
  };

  const onDragOver = (event: DragEvent): void => {
    event.preventDefault();
    if (hasFiles(event)) {
      dragActive.value = true;
    }
  };

  const onDragLeave = (event: DragEvent): void => {
    if (!event.relatedTarget) {
      dragActive.value = false;
    }
  };

  const onDrop = (event: DragEvent): void => {
    event.preventDefault();
    dragActive.value = false;
    const files = Array.from(event.dataTransfer?.files ?? []);
    if (files.length) {
      handlers.onFiles(files);
    }
  };

  onMounted(() => {
    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);

    if (inTauri()) {
      void getCurrentWebview()
        .onDragDropEvent((event) => {
          const payload = event.payload;
          if (payload.type === "enter" || payload.type === "over") {
            dragActive.value = true;
          } else if (payload.type === "leave") {
            dragActive.value = false;
          } else if (payload.type === "drop") {
            dragActive.value = false;
            handlers.onPaths(payload.paths);
          }
        })
        .then((stop) => {
          if (disposed) {
            stop();
          } else {
            unlisten = stop;
          }
        });
    }
  });

  onUnmounted(() => {
    disposed = true;
    window.removeEventListener("dragenter", onDragEnter);
    window.removeEventListener("dragover", onDragOver);
    window.removeEventListener("dragleave", onDragLeave);
    window.removeEventListener("drop", onDrop);
    unlisten?.();
  });

  return { dragActive };
}
