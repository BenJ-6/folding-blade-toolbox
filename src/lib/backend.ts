import { invoke } from "@tauri-apps/api/core";
import type { OutputFormat, ProcessOptions } from "@/types";

export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function resolveOutputMime(sourceMime: string, format: OutputFormat): string {
  if (format === "jpeg") {
    return "image/jpeg";
  }
  if (format === "png") {
    return "image/png";
  }
  if (sourceMime === "image/png") {
    return "image/png";
  }
  return "image/jpeg";
}

export function makeOutputName(name: string, suffix: string, mime: string): string {
  const base = name.replace(/\.(jpe?g|png|svg|gif)$/i, "");
  const extension =
    mime === "image/png"
      ? "png"
      : mime === "image/svg+xml"
        ? "svg"
        : mime === "image/gif"
          ? "gif"
          : "jpg";
  return `${base}${suffix}.${extension}`;
}

export async function processWithRust(
  path: string,
  options: ProcessOptions,
  sourceMime: string,
): Promise<Blob> {
  const payload = {
    format: options.format,
    quality: options.quality,
    resizeMode: options.resizeMode,
    percent: options.percent,
    width: options.width,
    height: options.height,
    keepRatio: options.keepRatio,
    maxSide: options.maxSide,
  };

  const result = await invoke<ArrayBuffer | Uint8Array>("process_image", {
    path,
    options: payload,
  });

  const source = result instanceof Uint8Array ? result : new Uint8Array(result);
  const buffer = new ArrayBuffer(source.byteLength);
  new Uint8Array(buffer).set(source);
  return new Blob([buffer], { type: resolveOutputMime(sourceMime, options.format) });
}
