export type OutputFormat = "auto" | "jpeg" | "png";

export type ResizeMode = "original" | "percent" | "fixed" | "max";

export type ItemStatus = "pending" | "processing" | "done" | "error";

export interface ImageResult {
  blob: Blob;
  url: string;
  width: number;
  height: number;
  size: number;
  mime: string;
  fileName: string;
}

export interface ImageItem {
  id: string;
  name: string;
  path?: string;
  file?: File;
  blob?: Blob;
  url: string;
  width: number;
  height: number;
  size: number;
  status: ItemStatus;
  result?: ImageResult;
  error?: string;
}

export interface ProcessOptions {
  format: OutputFormat;
  quality: number;
  resizeMode: ResizeMode;
  percent: number;
  width: number;
  height: number;
  keepRatio: boolean;
  maxSide: number;
  suffix: string;
  pngLossy: boolean;
  pngColors: number;
}

export const ACCEPTED_EXTENSIONS = ["jpg", "jpeg", "png", "svg", "gif"];

export const DEFAULT_OPTIONS: ProcessOptions = {
  format: "auto",
  quality: 82,
  resizeMode: "original",
  percent: 100,
  width: 1920,
  height: 1080,
  keepRatio: true,
  maxSide: 1600,
  suffix: "-min",
  pngLossy: false,
  pngColors: 128,
};
