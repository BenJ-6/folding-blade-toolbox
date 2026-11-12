import { invoke } from "@tauri-apps/api/core";
import type { OutputFormat, ProcessOptions } from "@/types";

export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function resolveOutputMime(
  sourceMime: string,
  targetFormat: OutputFormat = "source",
): string {
  if (targetFormat === "jpeg") {
    return "image/jpeg";
  }
  if (targetFormat === "png") {
    return "image/png";
  }
  if (sourceMime === "image/png" || sourceMime === "image/svg+xml" || sourceMime === "image/gif") {
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
    fixedSide: options.fixedSide,
    maxSide: options.maxSide,
    pngLossy: options.pngLossy,
    pngColors: options.pngColors,
    targetFormat: options.targetFormat,
    background: options.background,
    rasterScale: options.rasterScale,
    compressMode: options.compressMode,
    targetKb: Number.isFinite(options.targetKb) ? Math.max(0, Math.round(options.targetKb)) : 0,
  };

  const result = await invoke<ArrayBuffer | Uint8Array>("process_image", {
    path,
    options: payload,
  });

  return responseToBlob(result, resolveOutputMime(sourceMime, options.targetFormat));
}

function responseToBlob(result: ArrayBuffer | Uint8Array, mime: string): Blob {
  const source = result instanceof Uint8Array ? result : new Uint8Array(result);
  const buffer = new ArrayBuffer(source.byteLength);
  new Uint8Array(buffer).set(source);
  return new Blob([buffer], { type: mime });
}

export interface ImageMetaField {
  tag: string;
  value: string;
}

export interface ImageMeta {
  format: string;
  width: number;
  height: number;
  bytes: number;
  exif: ImageMetaField[];
}

export async function inspectImage(path: string): Promise<ImageMeta> {
  return invoke<ImageMeta>("inspect_image", { path });
}

export async function stripMetadata(path: string, mime: string): Promise<Blob> {
  const result = await invoke<ArrayBuffer | Uint8Array>("strip_metadata", { path });
  return responseToBlob(result, mime);
}

export interface StitchOptions {
  direction: "vertical" | "horizontal" | "grid";
  gap: number;
  columns: number;
  background: string;
}

export async function stitchImages(paths: string[], options: StitchOptions): Promise<Blob> {
  const result = await invoke<ArrayBuffer | Uint8Array>("stitch_images", { paths, options });
  return responseToBlob(result, "image/png");
}
