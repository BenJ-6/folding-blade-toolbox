import { decodeImage } from "@/lib/image";

export type WatermarkPosition =
  | "top-left"
  | "top"
  | "top-right"
  | "left"
  | "center"
  | "right"
  | "bottom-left"
  | "bottom"
  | "bottom-right"
  | "tile";

export interface WatermarkOptions {
  text: string;
  /** 字号，相对图片短边的百分比 */
  fontSize: number;
  color: string;
  /** 不透明度 0-100 */
  opacity: number;
  /** 旋转角度，单位度 */
  rotate: number;
  position: WatermarkPosition;
  /** Logo 的 DataURL，为空时使用文字水印 */
  logoDataUrl: string;
  /** Logo 宽度，相对图片宽度的百分比 */
  logoScale: number;
  quality: number;
}

const FONT_STACK = '"PingFang SC", "Microsoft YaHei", system-ui, sans-serif';

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Logo 读取失败"));
    image.src = url;
  });
}

function anchorPoint(
  position: Exclude<WatermarkPosition, "tile">,
  width: number,
  height: number,
  markWidth: number,
  markHeight: number,
  padding: number,
): { x: number; y: number } {
  const left = padding + markWidth / 2;
  const right = width - padding - markWidth / 2;
  const top = padding + markHeight / 2;
  const bottom = height - padding - markHeight / 2;

  switch (position) {
    case "top-left":
      return { x: left, y: top };
    case "top":
      return { x: width / 2, y: top };
    case "top-right":
      return { x: right, y: top };
    case "left":
      return { x: left, y: height / 2 };
    case "right":
      return { x: right, y: height / 2 };
    case "bottom-left":
      return { x: left, y: bottom };
    case "bottom":
      return { x: width / 2, y: bottom };
    case "bottom-right":
      return { x: right, y: bottom };
    default:
      return { x: width / 2, y: height / 2 };
  }
}

export async function applyWatermark(
  blob: Blob,
  sourceMime: string,
  options: WatermarkOptions,
): Promise<Blob> {
  if (!options.logoDataUrl && !options.text.trim()) {
    throw new Error("请先填写水印文字或上传 Logo");
  }

  const decoded = await decodeImage(blob);
  try {
    const width = decoded.width;
    const height = decoded.height;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Canvas 不可用");
    }

    const mime = sourceMime === "image/png" ? "image/png" : "image/jpeg";
    if (mime === "image/jpeg") {
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
    }
    context.drawImage(decoded.source, 0, 0, width, height);

    const alpha = Math.min(100, Math.max(0, options.opacity)) / 100;
    const rotate = (options.rotate * Math.PI) / 180;
    const padding = Math.min(width, height) * 0.04;

    context.save();
    context.globalAlpha = alpha;

    if (options.logoDataUrl) {
      const logo = await loadImage(options.logoDataUrl);
      const logoWidth = Math.max(8, (width * options.logoScale) / 100);
      const logoHeight = (logoWidth / logo.width) * logo.height;

      if (options.position === "tile") {
        const stepX = logoWidth * 1.8;
        const stepY = logoHeight * 1.8;
        for (let y = stepY / 2; y < height; y += stepY) {
          for (let x = stepX / 2; x < width; x += stepX) {
            context.save();
            context.translate(x, y);
            context.rotate(rotate);
            context.drawImage(logo, -logoWidth / 2, -logoHeight / 2, logoWidth, logoHeight);
            context.restore();
          }
        }
      } else {
        const anchor = anchorPoint(options.position, width, height, logoWidth, logoHeight, padding);
        context.save();
        context.translate(anchor.x, anchor.y);
        context.rotate(rotate);
        context.drawImage(logo, -logoWidth / 2, -logoHeight / 2, logoWidth, logoHeight);
        context.restore();
      }
    } else {
      const fontSize = Math.max(10, (Math.min(width, height) * options.fontSize) / 100);
      context.fillStyle = options.color;
      context.font = `600 ${fontSize}px ${FONT_STACK}`;
      context.textAlign = "center";
      context.textBaseline = "middle";

      const text = options.text.trim();
      const textWidth = context.measureText(text).width;

      if (options.position === "tile") {
        const stepX = textWidth + fontSize * 2;
        const stepY = fontSize * 4;
        for (let y = stepY / 2; y < height; y += stepY) {
          for (let x = stepX / 2; x < width; x += stepX) {
            context.save();
            context.translate(x, y);
            context.rotate(rotate);
            context.fillText(text, 0, 0);
            context.restore();
          }
        }
      } else {
        const anchor = anchorPoint(options.position, width, height, textWidth, fontSize, padding);
        context.save();
        context.translate(anchor.x, anchor.y);
        context.rotate(rotate);
        context.fillText(text, 0, 0);
        context.restore();
      }
    }

    context.restore();

    const output = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => (result ? resolve(result) : reject(new Error("编码失败"))),
        mime,
        Math.min(100, Math.max(1, options.quality)) / 100,
      );
    });

    return output;
  } finally {
    decoded.dispose();
  }
}

export function watermarkFileName(name: string, mime: string): string {
  const base = name.replace(/\.[^.]+$/, "");
  return `${base}-wm.${mime === "image/png" ? "png" : "jpg"}`;
}
