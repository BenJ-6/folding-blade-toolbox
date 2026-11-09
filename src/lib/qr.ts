import jsQR from "jsqr";
import { encode } from "uqr";

import { decodeImage } from "@/lib/image";

export type QrEcc = "L" | "M" | "Q" | "H";
export type QrDotStyle = "square" | "rounded" | "dots";

export interface QrStyle {
  size: number;
  margin: number;
  ecc: QrEcc;
  fg: string;
  bg: string;
  dotStyle: QrDotStyle;
}

export interface QrLogoImage {
  source: CanvasImageSource;
  width: number;
  height: number;
}

export interface QrGeometry {
  matrix: boolean[][];
  modules: number;
  margin: number;
  cell: number;
  canvasSize: number;
  version: number;
}

const FINDER_SIZE = 7;
const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

export const QR_IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "bmp", "gif", "svg"];

export const QR_SIZE_OPTIONS = [256, 512, 1024, 2048];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function safeColor(value: string, fallback: string): string {
  return HEX_COLOR.test(value.trim()) ? value.trim() : fallback;
}

function encodeMatrix(text: string, ecc: QrEcc): ReturnType<typeof encode> {
  try {
    return encode(text, { ecc, border: 0 });
  } catch {
    throw new Error("内容太长，二维码装不下，请精简内容后重试");
  }
}

export function buildQrGeometry(
  text: string,
  style: Pick<QrStyle, "ecc" | "margin" | "size">,
): QrGeometry {
  const result = encodeMatrix(text, style.ecc);
  const margin = clamp(Math.round(style.margin), 0, 10);
  const total = result.size + margin * 2;
  const cell = Math.max(1, Math.floor(clamp(Math.round(style.size), 64, 4096) / total));
  return {
    matrix: result.data,
    modules: result.size,
    margin,
    cell,
    canvasSize: cell * total,
    version: result.version,
  };
}

function isFinderModule(x: number, y: number, modules: number): boolean {
  return (
    (x < FINDER_SIZE && y < FINDER_SIZE) ||
    (x >= modules - FINDER_SIZE && y < FINDER_SIZE) ||
    (x < FINDER_SIZE && y >= modules - FINDER_SIZE)
  );
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  ctx.beginPath();
  if (r === 0) {
    ctx.rect(x, y, width, height);
    return;
  }
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function fillRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  color: string,
): void {
  ctx.fillStyle = color;
  roundRectPath(ctx, x, y, width, height, radius);
  ctx.fill();
}

function drawFinder(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  cell: number,
  style: QrDotStyle,
  fg: string,
  bg: string,
): void {
  const outer = style === "square" ? 0 : style === "dots" ? cell * 2.1 : cell * 1.3;
  fillRoundRect(ctx, x, y, cell * 7, cell * 7, outer, fg);
  fillRoundRect(
    ctx,
    x + cell,
    y + cell,
    cell * 5,
    cell * 5,
    Math.max(0, outer - cell * 0.7),
    bg,
  );
  fillRoundRect(
    ctx,
    x + cell * 2,
    y + cell * 2,
    cell * 3,
    cell * 3,
    Math.max(0, outer - cell * 1.4),
    fg,
  );
}

function drawLogo(
  ctx: CanvasRenderingContext2D,
  logo: QrLogoImage,
  size: number,
  bg: string,
): void {
  const box = size * 0.24;
  const pad = box * 0.1;
  const left = (size - box) / 2;
  const top = (size - box) / 2;
  fillRoundRect(ctx, left, top, box, box, box * 0.18, bg);

  const inner = box - pad * 2;
  const logoWidth = logo.width || 1;
  const logoHeight = logo.height || 1;
  const ratio = Math.min(inner / logoWidth, inner / logoHeight);
  const width = logoWidth * ratio;
  const height = logoHeight * ratio;
  ctx.drawImage(logo.source, (size - width) / 2, (size - height) / 2, width, height);
}

export function drawQrCanvas(
  canvas: HTMLCanvasElement,
  text: string,
  style: QrStyle,
  logo?: QrLogoImage | null,
): QrGeometry {
  const geometry = buildQrGeometry(text, style);
  const { matrix, modules, margin, cell, canvasSize } = geometry;
  const fg = safeColor(style.fg, "#111827");
  const bg = safeColor(style.bg, "#ffffff");

  canvas.width = canvasSize;
  canvas.height = canvasSize;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("当前环境不支持画布渲染");
  }

  ctx.clearRect(0, 0, canvasSize, canvasSize);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvasSize, canvasSize);

  const offset = margin * cell;
  for (let y = 0; y < modules; y += 1) {
    for (let x = 0; x < modules; x += 1) {
      if (!matrix[y][x] || isFinderModule(x, y, modules)) {
        continue;
      }
      const px = offset + x * cell;
      const py = offset + y * cell;
      if (style.dotStyle === "dots") {
        ctx.fillStyle = fg;
        ctx.beginPath();
        ctx.arc(px + cell / 2, py + cell / 2, cell * 0.48, 0, Math.PI * 2);
        ctx.fill();
      } else {
        fillRoundRect(
          ctx,
          px,
          py,
          cell,
          cell,
          style.dotStyle === "rounded" ? cell * 0.34 : 0,
          fg,
        );
      }
    }
  }

  const right = offset + (modules - FINDER_SIZE) * cell;
  const bottom = offset + (modules - FINDER_SIZE) * cell;
  drawFinder(ctx, offset, offset, cell, style.dotStyle, fg, bg);
  drawFinder(ctx, right, offset, cell, style.dotStyle, fg, bg);
  drawFinder(ctx, offset, bottom, cell, style.dotStyle, fg, bg);

  if (logo) {
    drawLogo(ctx, logo, canvasSize, bg);
  }

  return geometry;
}

function svgNumber(value: number): string {
  return String(Math.round(value * 100) / 100);
}

function svgRect(
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fill: string,
): string {
  const rx = radius > 0 ? ` rx="${svgNumber(radius)}"` : "";
  return `<rect x="${svgNumber(x)}" y="${svgNumber(y)}" width="${svgNumber(width)}" height="${svgNumber(height)}"${rx} fill="${fill}"/>`;
}

export function qrSvg(
  text: string,
  style: QrStyle,
  logoDataUrl?: string | null,
): string {
  const geometry = buildQrGeometry(text, style);
  const { matrix, modules, margin, cell, canvasSize } = geometry;
  const fg = safeColor(style.fg, "#111827");
  const bg = safeColor(style.bg, "#ffffff");
  const offset = margin * cell;
  const radius = style.dotStyle === "rounded" ? cell * 0.34 : 0;
  const parts: string[] = [];

  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasSize}" height="${canvasSize}" viewBox="0 0 ${canvasSize} ${canvasSize}" shape-rendering="crispEdges">`,
  );
  parts.push(`<rect width="${canvasSize}" height="${canvasSize}" fill="${bg}"/>`);

  if (style.dotStyle === "square") {
    let path = "";
    for (let y = 0; y < modules; y += 1) {
      for (let x = 0; x < modules; x += 1) {
        if (!matrix[y][x] || isFinderModule(x, y, modules)) {
          continue;
        }
        const px = offset + x * cell;
        const py = offset + y * cell;
        path += `M${px} ${py}h${cell}v${cell}h-${cell}z`;
      }
    }
    if (path) {
      parts.push(`<path d="${path}" fill="${fg}"/>`);
    }
  } else if (style.dotStyle === "dots") {
    for (let y = 0; y < modules; y += 1) {
      for (let x = 0; x < modules; x += 1) {
        if (!matrix[y][x] || isFinderModule(x, y, modules)) {
          continue;
        }
        const cx = offset + x * cell + cell / 2;
        const cy = offset + y * cell + cell / 2;
        parts.push(`<circle cx="${svgNumber(cx)}" cy="${svgNumber(cy)}" r="${svgNumber(cell * 0.48)}" fill="${fg}"/>`);
      }
    }
  } else {
    for (let y = 0; y < modules; y += 1) {
      for (let x = 0; x < modules; x += 1) {
        if (!matrix[y][x] || isFinderModule(x, y, modules)) {
          continue;
        }
        parts.push(
          svgRect(offset + x * cell, offset + y * cell, cell, cell, radius, fg),
        );
      }
    }
  }

  const finderRadius =
    style.dotStyle === "square" ? 0 : style.dotStyle === "dots" ? cell * 2.1 : cell * 1.3;
  const finders: Array<[number, number]> = [
    [offset, offset],
    [offset + (modules - FINDER_SIZE) * cell, offset],
    [offset, offset + (modules - FINDER_SIZE) * cell],
  ];
  for (const [fx, fy] of finders) {
    parts.push(svgRect(fx, fy, cell * 7, cell * 7, finderRadius, fg));
    parts.push(
      svgRect(
        fx + cell,
        fy + cell,
        cell * 5,
        cell * 5,
        Math.max(0, finderRadius - cell * 0.7),
        bg,
      ),
    );
    parts.push(
      svgRect(
        fx + cell * 2,
        fy + cell * 2,
        cell * 3,
        cell * 3,
        Math.max(0, finderRadius - cell * 1.4),
        fg,
      ),
    );
  }

  if (logoDataUrl) {
    const box = canvasSize * 0.24;
    const pad = box * 0.1;
    const left = (canvasSize - box) / 2;
    const top = (canvasSize - box) / 2;
    parts.push(svgRect(left, top, box, box, box * 0.18, bg));
    parts.push(
      `<image href="${logoDataUrl}" x="${svgNumber(left + pad)}" y="${svgNumber(top + pad)}" width="${svgNumber(box - pad * 2)}" height="${svgNumber(box - pad * 2)}" preserveAspectRatio="xMidYMid meet"/>`,
    );
  }

  parts.push("</svg>");
  return parts.join("");
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("导出图片失败，请重试"));
      }
    }, "image/png");
  });
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("读取文件失败"));
    reader.readAsDataURL(file);
  });
}

export function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("无法解析图片"));
    image.src = source;
  });
}

export function contrastRatio(foreground: string, background: string): number {
  const fg = relativeLuminance(safeColor(foreground, "#111827"));
  const bg = relativeLuminance(safeColor(background, "#ffffff"));
  const lighter = Math.max(fg, bg);
  const darker = Math.min(fg, bg);
  return (lighter + 0.05) / (darker + 0.05);
}

function relativeLuminance(hex: string): number {
  const normalized =
    hex.length === 4
      ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
      : hex;
  const channels = [1, 3, 5].map((start) => {
    const value = parseInt(normalized.slice(start, start + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

export type WifiEncryption = "WPA" | "WEP" | "nopass";

export interface WifiInput {
  ssid: string;
  password: string;
  encryption: WifiEncryption;
  hidden: boolean;
}

export interface VcardInput {
  name: string;
  org: string;
  tel: string;
  email: string;
  url: string;
}

function escapeWifi(value: string): string {
  return value.replace(/([\\;,:"])/g, "\\$1");
}

export function buildWifiPayload(input: WifiInput): string {
  const parts = [`T:${input.encryption}`, `S:${escapeWifi(input.ssid)}`];
  if (input.encryption !== "nopass" && input.password) {
    parts.push(`P:${escapeWifi(input.password)}`);
  }
  if (input.hidden) {
    parts.push("H:true");
  }
  return `WIFI:${parts.join(";")};;`;
}

function escapeVcard(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

export function buildVcardPayload(input: VcardInput): string {
  const lines = ["BEGIN:VCARD", "VERSION:3.0"];
  const name = input.name.trim();
  lines.push(`FN:${escapeVcard(name)}`);
  lines.push(`N:${escapeVcard(name)};;;;`);
  if (input.org.trim()) {
    lines.push(`ORG:${escapeVcard(input.org.trim())}`);
  }
  if (input.tel.trim()) {
    lines.push(`TEL;TYPE=CELL:${escapeVcard(input.tel.trim())}`);
  }
  if (input.email.trim()) {
    lines.push(`EMAIL:${escapeVcard(input.email.trim())}`);
  }
  if (input.url.trim()) {
    lines.push(`URL:${escapeVcard(input.url.trim())}`);
  }
  lines.push("END:VCARD");
  // vCard 规范要求 CRLF 换行，部分扫码解析器对此较严格
  return `${lines.join("\r\n")}\r\n`;
}

export type QrContentKind = "url" | "wifi" | "vcard" | "email" | "tel" | "text";

export interface QrWifiInfo {
  ssid: string;
  password: string;
  encryption: string;
  hidden: boolean;
}

export interface QrVcardInfo {
  name?: string;
  org?: string;
  tel?: string;
  email?: string;
  url?: string;
}

export interface QrContentInfo {
  kind: QrContentKind;
  label: string;
  url?: string;
  email?: string;
  phone?: string;
  wifi?: QrWifiInfo;
  vcard?: QrVcardInfo;
}

export const QR_KIND_LABELS: Record<QrContentKind, string> = {
  url: "链接",
  wifi: "Wi-Fi",
  vcard: "名片",
  email: "邮件",
  tel: "电话",
  text: "文本",
};

function normalizeUrl(value: string): string {
  return /^www\./i.test(value) ? `https://${value}` : value;
}

function parseWifiPayload(raw: string): QrWifiInfo | null {
  const body = raw.replace(/^WIFI:/i, "");
  const fields: Record<string, string> = {};
  let key = "";
  let value = "";
  let readingValue = false;
  let escaped = false;

  for (const char of body) {
    if (escaped) {
      value += char;
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (readingValue) {
      if (char === ";") {
        if (key.trim()) {
          fields[key.trim().toUpperCase()] = value;
        }
        key = "";
        value = "";
        readingValue = false;
      } else {
        value += char;
      }
    } else if (char === ":") {
      readingValue = true;
    } else if (char === ";") {
      key = "";
    } else {
      key += char;
    }
  }

  if (!fields.S) {
    return null;
  }
  return {
    ssid: fields.S,
    password: fields.P ?? "",
    encryption: fields.T || "nopass",
    hidden: (fields.H ?? "").toLowerCase() === "true",
  };
}

function unescapeVcard(value: string): string {
  return value
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

function parseVcardPayload(raw: string): QrVcardInfo {
  const info: QrVcardInfo = {};
  for (const line of raw.split(/\r?\n/)) {
    const separator = line.indexOf(":");
    if (separator === -1) {
      continue;
    }
    // 去掉 TYPE、CHARSET 等参数，只保留属性名
    const field = line.slice(0, separator).split(";")[0].trim().toUpperCase();
    const value = unescapeVcard(line.slice(separator + 1).trim());
    if (!value) {
      continue;
    }
    if (field === "FN" && !info.name) {
      info.name = value;
    } else if (field === "N" && !info.name) {
      info.name = value.replace(/;+/g, " ").trim();
    } else if (field === "ORG") {
      info.org = value;
    } else if (field === "TEL") {
      info.tel = value;
    } else if (field === "EMAIL") {
      info.email = value;
    } else if (field === "URL") {
      info.url = value;
    }
  }
  return info;
}

export function analyzeQrContent(raw: string): QrContentInfo {
  const value = raw.trim();
  if (/^WIFI:/i.test(value)) {
    const wifi = parseWifiPayload(value);
    if (wifi) {
      return { kind: "wifi", label: QR_KIND_LABELS.wifi, wifi };
    }
  }
  if (/^BEGIN:VCARD/i.test(value)) {
    return { kind: "vcard", label: QR_KIND_LABELS.vcard, vcard: parseVcardPayload(value) };
  }
  if (/^https?:\/\//i.test(value) || /^www\./i.test(value)) {
    return { kind: "url", label: QR_KIND_LABELS.url, url: normalizeUrl(value) };
  }
  if (/^mailto:/i.test(value)) {
    return { kind: "email", label: QR_KIND_LABELS.email, email: value.slice(7).trim() };
  }
  if (/^tel:/i.test(value)) {
    return { kind: "tel", label: QR_KIND_LABELS.tel, phone: value.slice(4).trim() };
  }
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return { kind: "email", label: QR_KIND_LABELS.email, email: value };
  }
  return { kind: "text", label: QR_KIND_LABELS.text };
}

export interface QrDecodeResult {
  text: string;
  info: QrContentInfo;
}

export async function decodeQrImage(blob: Blob): Promise<QrDecodeResult | null> {
  const decoded = await decodeImage(blob);
  try {
    if (!decoded.width || !decoded.height) {
      throw new Error("无法读取图片尺寸");
    }
    const maxSide = 1600;
    const scale = Math.min(1, maxSide / Math.max(decoded.width, decoded.height));
    const width = Math.max(32, Math.round(decoded.width * scale));
    const height = Math.max(32, Math.round(decoded.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      throw new Error("当前环境不支持图片解析");
    }
    ctx.drawImage(decoded.source, 0, 0, width, height);
    const imageData = ctx.getImageData(0, 0, width, height);
    const code = jsQR(imageData.data, width, height, { inversionAttempts: "attemptBoth" });
    if (!code) {
      return null;
    }
    return { text: code.data, info: analyzeQrContent(code.data) };
  } finally {
    decoded.dispose();
  }
}

export function qrFileName(text: string, extension: string): string {
  const info = analyzeQrContent(text);
  let base = "";
  if (info.url) {
    try {
      base = new URL(info.url).hostname;
    } catch {
      base = "";
    }
  } else if (info.wifi?.ssid) {
    base = `wifi-${info.wifi.ssid}`;
  } else if (info.vcard?.name) {
    base = `vcard-${info.vcard.name}`;
  }
  if (!base) {
    base = "qrcode";
  }
  const safe = base
    .replace(/[\\/:*?"<>|\s]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `${safe || "qrcode"}.${extension}`;
}
