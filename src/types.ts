export type ResizeMode = "original" | "percent" | "fixed" | "max" | "crop";

export type OutputFormat = "source" | "jpeg" | "png";

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

export type FixedSide = "width" | "height";

export interface ProcessOptions {
  quality: number;
  resizeMode: ResizeMode;
  percent: number;
  width: number;
  height: number;
  keepRatio: boolean;
  fixedSide: FixedSide;
  maxSide: number;
  suffix: string;
  pngLossy: boolean;
  pngColors: number;
  targetFormat: OutputFormat;
  background: string;
  rasterScale: number;
}

export const ACCEPTED_EXTENSIONS = ["jpg", "jpeg", "png", "svg", "gif"];

export const DEFAULT_OPTIONS: ProcessOptions = {
  quality: 82,
  resizeMode: "original",
  percent: 100,
  width: 1920,
  height: 1080,
  keepRatio: true,
  fixedSide: "width",
  maxSide: 1600,
  suffix: "-min",
  pngLossy: false,
  pngColors: 128,
  targetFormat: "source",
  background: "#ffffff",
  rasterScale: 2,
};
