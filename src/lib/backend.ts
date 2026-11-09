import { invoke } from "@tauri-apps/api/core";
import type { ProcessOptions } from "@/types";

export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function resolveOutputMime(sourceMime: string): string {
  if (
    sourceMime === "image/png" ||
    sourceMime === "image/svg+xml" ||
    sourceMime === "image/gif"
  ) {
    return sourceMime;
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
    quality: options.quality,
    resizeMode: options.resizeMode,
    percent: options.percent,
    width: options.width,
    height: options.height,
    keepRatio: options.keepRatio,
    maxSide: options.maxSide,
    pngLossy: options.pngLossy,
    pngColors: options.pngColors,
  };

  const result = await invoke<ArrayBuffer | Uint8Array>("process_image", {
    path,
    options: payload,
  });

  const source = result instanceof Uint8Array ? result : new Uint8Array(result);
  const buffer = new ArrayBuffer(source.byteLength);
  new Uint8Array(buffer).set(source);
  return new Blob([buffer], { type: resolveOutputMime(sourceMime) });
}
