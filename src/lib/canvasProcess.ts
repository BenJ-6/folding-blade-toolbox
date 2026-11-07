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
      const scale = Math.min(options.width / width, options.height / height);
      targetWidth = width * scale;
      targetHeight = height * scale;
    } else {
      targetWidth = options.width;
      targetHeight = options.height;
    }
  } else if (options.resizeMode === "max") {
    const scale = Math.min(1, options.maxSide / Math.max(width, height));
    targetWidth = width * scale;
    targetHeight = height * scale;
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
  if (sourceMime === "image/svg+xml" || sourceMime === "image/gif") {
    throw new Error("SVG / GIF 处理将在后续阶段接入");
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

    const mime = resolveOutputMime(sourceMime, options.format);
    if (mime === "image/jpeg") {
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, target.width, target.height);
    }

    drawHighQuality(
      context,
      decoded.source,
      decoded.width,
      decoded.height,
      target.width,
      target.height,
    );

    const output = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => (result ? resolve(result) : reject(new Error("编码失败"))),
        mime,
        options.quality / 100,
      );
    });

    const resized = target.width !== decoded.width || target.height !== decoded.height;
    if (!resized && mime === sourceMime && output.size > blob.size) {
      return blob;
    }
    return output;
  } finally {
    decoded.dispose();
  }
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
