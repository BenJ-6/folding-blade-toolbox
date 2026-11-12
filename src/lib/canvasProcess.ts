import { resolveOutputMime } from "@/lib/backend";
import { decodeImage } from "@/lib/image";
import type { ProcessOptions } from "@/types";

export interface TargetSize {
  width: number;
  height: number;
}

export function computeTargetSize(
  width: number,
  height: number,
  options: ProcessOptions,
): TargetSize {
  let targetWidth = width;
  let targetHeight = height;

  if (options.resizeMode === "percent") {
    const scale = Math.min(200, Math.max(10, options.percent)) / 100;
    targetWidth = width * scale;
    targetHeight = height * scale;
  } else if (options.resizeMode === "fixed") {
    if (options.keepRatio) {
      if (options.fixedSide === "height") {
        const scale = options.height / height;
        targetWidth = width * scale;
        targetHeight = options.height;
      } else {
        const scale = options.width / width;
        targetWidth = options.width;
        targetHeight = height * scale;
      }
    } else {
      targetWidth = options.width;
      targetHeight = options.height;
    }
  } else if (options.resizeMode === "max") {
    const scale = Math.min(1, options.maxSide / Math.max(width, height));
    targetWidth = width * scale;
    targetHeight = height * scale;
  } else if (options.resizeMode === "crop") {
    targetWidth = options.width;
    targetHeight = options.height;
  }

  return {
    width: Math.min(8000, Math.max(1, Math.round(targetWidth))),
    height: Math.min(8000, Math.max(1, Math.round(targetHeight))),
  };
}

export async function processWithCanvas(
  blob: Blob,
  options: ProcessOptions,
  sourceMime: string,
): Promise<Blob> {
  const mime = resolveOutputMime(sourceMime, options.targetFormat);
  if (
    (sourceMime === "image/svg+xml" || sourceMime === "image/gif") &&
    options.targetFormat === "source"
  ) {
    throw new Error("SVG / GIF 压缩需要在桌面应用中使用");
  }

  const decoded = await decodeImage(blob);
  try {
    const target = computeTargetSize(decoded.width, decoded.height, options);
    const canvas = document.createElement("canvas");
    canvas.width = target.width;
    canvas.height = target.height;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Canvas 不可用");
    }

    if (mime === "image/jpeg") {
      context.fillStyle = options.background || "#ffffff";
      context.fillRect(0, 0, target.width, target.height);
    }

    if (options.resizeMode === "crop") {
      drawCover(
        context,
        decoded.source,
        decoded.width,
        decoded.height,
        target.width,
        target.height,
      );
    } else {
      drawHighQuality(
        context,
        decoded.source,
        decoded.width,
        decoded.height,
        target.width,
        target.height,
      );
    }

    const targetBytes =
      options.compressMode === "target" ? Math.max(1, options.targetKb) * 1024 : 0;

    let output: Blob;
    if (targetBytes > 0 && mime === "image/jpeg") {
      output = await encodeJpegWithinTarget(canvas, targetBytes);
    } else {
      output = await toBlob(canvas, mime, options.quality / 100);
    }

    const resized = target.width !== decoded.width || target.height !== decoded.height;
    if (!resized && mime === sourceMime && output.size > blob.size) {
      return blob;
    }
    return output;
  } finally {
    decoded.dispose();
  }
}

function toBlob(canvas: HTMLCanvasElement, mime: string, quality: number): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error("编码失败"))),
      mime,
      quality,
    );
  });
}

/** 二分搜索质量，取体积不超过目标值的最高画质 */
async function encodeJpegWithinTarget(
  canvas: HTMLCanvasElement,
  targetBytes: number,
): Promise<Blob> {
  let best: Blob | null = null;
  let low = 1;
  let high = 95;

  while (low <= high) {
    const quality = Math.round((low + high) / 2);
    const blob = await toBlob(canvas, "image/jpeg", quality / 100);
    if (blob.size <= targetBytes) {
      best = blob;
      low = quality + 1;
    } else {
      high = quality - 1;
    }
  }

  return best ?? toBlob(canvas, "image/jpeg", 0.01);
}

function drawCover(
  context: CanvasRenderingContext2D,
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
): void {
  const scale = Math.max(targetWidth / sourceWidth, targetHeight / sourceHeight);
  const cropWidth = targetWidth / scale;
  const cropHeight = targetHeight / scale;
  const cropX = (sourceWidth - cropWidth) / 2;
  const cropY = (sourceHeight - cropHeight) / 2;

  context.imageSmoothingQuality = "high";
  context.drawImage(source, cropX, cropY, cropWidth, cropHeight, 0, 0, targetWidth, targetHeight);
}

function drawHighQuality(
  context: CanvasRenderingContext2D,
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
): void {
  let current = source;
  let currentWidth = sourceWidth;
  let currentHeight = sourceHeight;

  while (currentWidth > targetWidth * 2 && currentHeight > targetHeight * 2) {
    const nextWidth = Math.max(targetWidth, Math.floor(currentWidth / 2));
    const nextHeight = Math.max(targetHeight, Math.floor(currentHeight / 2));
    const step = document.createElement("canvas");
    step.width = nextWidth;
    step.height = nextHeight;
    const stepContext = step.getContext("2d");
    if (!stepContext) {
      break;
    }
    stepContext.imageSmoothingQuality = "high";
    stepContext.drawImage(current, 0, 0, currentWidth, currentHeight, 0, 0, nextWidth, nextHeight);
    current = step;
    currentWidth = nextWidth;
    currentHeight = nextHeight;
  }

  context.imageSmoothingQuality = "high";
  context.drawImage(current, 0, 0, currentWidth, currentHeight, 0, 0, targetWidth, targetHeight);
}
