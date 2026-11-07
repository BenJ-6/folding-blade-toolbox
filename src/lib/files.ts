import { open, save as saveDialog } from "@tauri-apps/plugin-dialog";
import { readFile, writeFile } from "@tauri-apps/plugin-fs";
import { ACCEPTED_EXTENSIONS } from "@/types";

export interface PickedFile {
  name: string;
  path?: string;
  file?: File;
}

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  bmp: "image/bmp",
};

const DIALOG_FILTER = {
  name: "图片",
  extensions: [...ACCEPTED_EXTENSIONS],
};

export const ACCEPT_ATTRIBUTE = ACCEPTED_EXTENSIONS.map((ext) => `.${ext}`).join(",");

function inTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function isAcceptedImage(name: string): boolean {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return ACCEPTED_EXTENSIONS.includes(ext);
}

export function guessMime(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXT[ext] ?? "application/octet-stream";
}

export async function pickImages(): Promise<PickedFile[]> {
  if (inTauri()) {
    const selection = await open({
      multiple: true,
      directory: false,
      filters: [DIALOG_FILTER],
    });
    const paths = typeof selection === "string" ? [selection] : (selection ?? []);
    return paths.map((path) => ({ path, name: path.split(/[\\/]/).pop() ?? path }));
  }

  const files = await pickWithInput();
  return files.map((file) => ({ file, name: file.name }));
}

function pickWithInput(): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ACCEPT_ATTRIBUTE;
    input.multiple = true;
    input.style.display = "none";

    const finish = (files: File[]) => {
      input.remove();
      resolve(files);
    };

    input.addEventListener("change", () => finish(Array.from(input.files ?? [])));
    input.addEventListener("cancel", () => finish([]));

    document.body.appendChild(input);
    input.click();
  });
}

export async function readImageFile(picked: PickedFile): Promise<Blob> {
  if (picked.file) {
    return picked.file;
  }
  if (!picked.path) {
    throw new Error("缺少文件路径");
  }
  const bytes = await readFile(picked.path);
  return new Blob([toArrayBuffer(bytes)], { type: guessMime(picked.name) });
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

export async function saveImage(blob: Blob, fileName: string): Promise<boolean> {
  if (inTauri()) {
    const ext = fileName.split(".").pop() ?? "png";
    const path = await saveDialog({
      defaultPath: fileName,
      filters: [{ name: ext.toUpperCase(), extensions: [ext] }],
    });
    if (!path) {
      return false;
    }
    await writeFile(path, new Uint8Array(await blob.arrayBuffer()));
    return true;
  }

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return true;
}
