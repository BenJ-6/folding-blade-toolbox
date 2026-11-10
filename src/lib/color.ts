export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface Hsl {
  h: number;
  s: number;
  l: number;
}

export interface Hsv {
  h: number;
  s: number;
  v: number;
}

export interface Cmyk {
  c: number;
  m: number;
  y: number;
  k: number;
}

export interface ParsedColor {
  hex: string;
  alpha: number;
}

export type ColorFormat = "hex" | "rgb" | "hsl" | "hsv" | "cmyk";

export type HarmonyMode =
  "complementary" | "analogous" | "triadic" | "split" | "tetradic" | "monochrome";

const HEX_PATTERN = /^#?([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const RGBA_PATTERN = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i;

const HARMONY_OFFSETS: Record<Exclude<HarmonyMode, "monochrome">, number[]> = {
  complementary: [0, 180],
  analogous: [-60, -30, 0, 30, 60],
  triadic: [0, 120, 240],
  split: [0, 150, 210],
  tetradic: [0, 90, 180, 270],
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundTo(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function parseHex(input: string): ParsedColor | null {
  const value = input.trim();
  if (!HEX_PATTERN.test(value)) {
    return null;
  }

  const body = value.replace(/^#/, "").toLowerCase();
  const expand = (part: string): number => parseInt(part.length === 1 ? part + part : part, 16);

  let r: number;
  let g: number;
  let b: number;
  let alpha = 1;

  if (body.length <= 4) {
    r = expand(body[0]);
    g = expand(body[1]);
    b = expand(body[2]);
    if (body.length === 4) {
      alpha = expand(body[3]) / 255;
    }
  } else {
    r = parseInt(body.slice(0, 2), 16);
    g = parseInt(body.slice(2, 4), 16);
    b = parseInt(body.slice(4, 6), 16);
    if (body.length === 8) {
      alpha = parseInt(body.slice(6, 8), 16) / 255;
    }
  }

  return { hex: rgbToHex({ r, g, b }), alpha: clamp(alpha, 0, 1) };
}

let colorContext: CanvasRenderingContext2D | null | undefined;

function getColorContext(): CanvasRenderingContext2D | null {
  if (colorContext !== undefined) {
    return colorContext;
  }
  if (typeof document === "undefined") {
    colorContext = null;
    return colorContext;
  }
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  colorContext = canvas.getContext("2d");
  return colorContext;
}

function normalizeCssColor(value: string): string | null {
  if (typeof CSS !== "undefined" && typeof CSS.supports === "function") {
    if (!CSS.supports("color", value)) {
      return null;
    }
  }

  const context = getColorContext();
  if (!context) {
    return null;
  }

  context.fillStyle = "#010203";
  context.fillStyle = value;
  const normalized = context.fillStyle;
  if (typeof normalized !== "string") {
    return null;
  }
  if (normalized === "#010203" && value.trim().toLowerCase() !== "#010203") {
    return null;
  }
  return normalized;
}

function parseRgba(value: string): ParsedColor | null {
  const match = RGBA_PATTERN.exec(value.trim());
  if (!match) {
    return null;
  }
  const r = clamp(Math.round(Number(match[1])), 0, 255);
  const g = clamp(Math.round(Number(match[2])), 0, 255);
  const b = clamp(Math.round(Number(match[3])), 0, 255);
  const alpha = match[4] === undefined ? 1 : clamp(Number(match[4]), 0, 1);
  return { hex: rgbToHex({ r, g, b }), alpha };
}

/**
 * 解析用户输入的颜色。支持 HEX(3/4/6/8)、rgb(a)、hsl(a)、颜色名等
 * 所有浏览器可识别的 CSS 颜色格式。
 */
export function parseColor(input: string): ParsedColor | null {
  const value = input.trim();
  if (!value) {
    return null;
  }

  const hex = parseHex(value);
  if (hex) {
    return hex;
  }

  const normalized = normalizeCssColor(value);
  if (!normalized) {
    return null;
  }

  const fromHex = parseHex(normalized);
  if (fromHex) {
    return fromHex;
  }

  return parseRgba(normalized);
}

export function rgbToHex(rgb: Rgb): string {
  const channel = (value: number): string =>
    clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0");
  return `#${channel(rgb.r)}${channel(rgb.g)}${channel(rgb.b)}`;
}

export function hexToRgb(hex: string): Rgb {
  const parsed = parseHex(hex);
  const normalized = parsed?.hex ?? "#000000";
  return {
    r: parseInt(normalized.slice(1, 3), 16),
    g: parseInt(normalized.slice(3, 5), 16),
    b: parseInt(normalized.slice(5, 7), 16),
  };
}

export function rgbToHsl(rgb: Rgb): Hsl {
  const r = clamp(rgb.r, 0, 255) / 255;
  const g = clamp(rgb.g, 0, 255) / 255;
  const b = clamp(rgb.b, 0, 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;

  if (max !== min) {
    const delta = max - min;
    s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    if (max === r) {
      h = (g - b) / delta + (g < b ? 6 : 0);
    } else if (max === g) {
      h = (b - r) / delta + 2;
    } else {
      h = (r - g) / delta + 4;
    }
    h *= 60;
  }

  return { h, s: s * 100, l: l * 100 };
}

export function hslToRgb({ h, s, l }: Hsl): Rgb {
  const hue = ((h % 360) + 360) % 360;
  const saturation = clamp(s, 0, 100) / 100;
  const lightness = clamp(l, 0, 100) / 100;
  const c = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = lightness - c / 2;

  let channels: [number, number, number];
  if (hue < 60) {
    channels = [c, x, 0];
  } else if (hue < 120) {
    channels = [x, c, 0];
  } else if (hue < 180) {
    channels = [0, c, x];
  } else if (hue < 240) {
    channels = [0, x, c];
  } else if (hue < 300) {
    channels = [x, 0, c];
  } else {
    channels = [c, 0, x];
  }

  return {
    r: Math.round((channels[0] + m) * 255),
    g: Math.round((channels[1] + m) * 255),
    b: Math.round((channels[2] + m) * 255),
  };
}

export function rgbToHsv(rgb: Rgb): Hsv {
  const r = clamp(rgb.r, 0, 255) / 255;
  const g = clamp(rgb.g, 0, 255) / 255;
  const b = clamp(rgb.b, 0, 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const h = rgbToHsl(rgb).h;
  return {
    h,
    s: max === 0 ? 0 : (delta / max) * 100,
    v: max * 100,
  };
}

export function rgbToCmyk(rgb: Rgb): Cmyk {
  const r = clamp(rgb.r, 0, 255) / 255;
  const g = clamp(rgb.g, 0, 255) / 255;
  const b = clamp(rgb.b, 0, 255) / 255;
  const k = 1 - Math.max(r, g, b);
  if (k >= 1) {
    return { c: 0, m: 0, y: 0, k: 100 };
  }
  return {
    c: ((1 - r - k) / (1 - k)) * 100,
    m: ((1 - g - k) / (1 - k)) * 100,
    y: ((1 - b - k) / (1 - k)) * 100,
    k: k * 100,
  };
}

export function formatHex(hex: string, alpha = 1): string {
  const base = hex.replace(/^#/, "").toUpperCase();
  if (alpha >= 1) {
    return `#${base}`;
  }
  const alphaHex = Math.round(clamp(alpha, 0, 1) * 255)
    .toString(16)
    .padStart(2, "0")
    .toUpperCase();
  return `#${base}${alphaHex}`;
}

export function formatRgb(rgb: Rgb, alpha = 1): string {
  const r = Math.round(rgb.r);
  const g = Math.round(rgb.g);
  const b = Math.round(rgb.b);
  if (alpha >= 1) {
    return `rgb(${r}, ${g}, ${b})`;
  }
  return `rgba(${r}, ${g}, ${b}, ${roundTo(clamp(alpha, 0, 1))})`;
}

export function formatHsl(rgb: Rgb, alpha = 1): string {
  const hsl = rgbToHsl(rgb);
  const base = `${Math.round(hsl.h)}, ${Math.round(hsl.s)}%, ${Math.round(hsl.l)}%`;
  if (alpha >= 1) {
    return `hsl(${base})`;
  }
  return `hsla(${base}, ${roundTo(clamp(alpha, 0, 1))})`;
}

export function formatHsv(rgb: Rgb): string {
  const hsv = rgbToHsv(rgb);
  return `hsv(${Math.round(hsv.h)}, ${Math.round(hsv.s)}%, ${Math.round(hsv.v)}%)`;
}

export function formatCmyk(rgb: Rgb): string {
  const cmyk = rgbToCmyk(rgb);
  return `cmyk(${Math.round(cmyk.c)}%, ${Math.round(cmyk.m)}%, ${Math.round(cmyk.y)}%, ${Math.round(
    cmyk.k,
  )}%)`;
}

export function formatColor(hex: string, format: ColorFormat, alpha = 1): string {
  const rgb = hexToRgb(hex);
  switch (format) {
    case "rgb":
      return formatRgb(rgb, alpha);
    case "hsl":
      return formatHsl(rgb, alpha);
    case "hsv":
      return formatHsv(rgb);
    case "cmyk":
      return formatCmyk(rgb);
    default:
      return formatHex(hex, alpha);
  }
}

export function relativeLuminance(rgb: Rgb): number {
  const channel = (value: number): number => {
    const s = clamp(value, 0, 255) / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

export function contrastRatio(colorA: string, colorB: string): number {
  const lumA = relativeLuminance(hexToRgb(colorA));
  const lumB = relativeLuminance(hexToRgb(colorB));
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

export interface ContrastLevel {
  aaNormal: boolean;
  aaaNormal: boolean;
  aaLarge: boolean;
  aaaLarge: boolean;
}

export function contrastLevel(ratio: number): ContrastLevel {
  return {
    aaNormal: ratio >= 4.5,
    aaaNormal: ratio >= 7,
    aaLarge: ratio >= 3,
    aaaLarge: ratio >= 4.5,
  };
}

/** 在该背景上更易读的文字颜色（黑或白） */
export function readableTextColor(hex: string): string {
  const onWhite = contrastRatio(hex, "#ffffff");
  const onDark = contrastRatio(hex, "#111827");
  return onWhite >= onDark ? "#ffffff" : "#111827";
}

export function mixHex(colorA: string, colorB: string, weight: number): string {
  const a = hexToRgb(colorA);
  const b = hexToRgb(colorB);
  const t = clamp(weight, 0, 1);
  return rgbToHex({
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  });
}

const SHADE_STEPS = [0.92, 0.76, 0.56, 0.36, 0.18, 0, 0.14, 0.3, 0.46, 0.62];

/** 从浅到深生成 10 级色阶 */
export function shadesAndTints(hex: string): string[] {
  return SHADE_STEPS.map((amount, index) =>
    index < 5 ? mixHex(hex, "#ffffff", amount) : mixHex(hex, "#000000", amount),
  );
}

export function rotateHue(hex: string, degrees: number): string {
  const hsl = rgbToHsl(hexToRgb(hex));
  return rgbToHex(hslToRgb({ ...hsl, h: hsl.h + degrees }));
}

export function harmonyColors(hex: string, mode: HarmonyMode): string[] {
  if (mode === "monochrome") {
    const hsl = rgbToHsl(hexToRgb(hex));
    return [-30, -15, 0, 15, 30].map((delta) =>
      rgbToHex(hslToRgb({ ...hsl, l: clamp(hsl.l + delta, 4, 96) })),
    );
  }
  return HARMONY_OFFSETS[mode].map((offset) => rotateHue(hex, offset));
}

export function randomHex(): string {
  const h = Math.random() * 360;
  const s = 58 + Math.random() * 30;
  const l = 42 + Math.random() * 16;
  return rgbToHex(hslToRgb({ h, s, l }));
}

/** 在保持色相与饱和度的前提下，找一个满足对比度目标的前景色 */
export function suggestAccessibleColor(
  hex: string,
  background: string,
  target = 4.5,
): string | null {
  const backgroundLum = relativeLuminance(hexToRgb(background));
  const hsl = rgbToHsl(hexToRgb(hex));
  const step = backgroundLum > 0.4 ? -1 : 1;
  let lightness = Math.round(hsl.l);

  while (lightness >= 0 && lightness <= 100) {
    const candidate = rgbToHex(hslToRgb({ ...hsl, l: lightness }));
    if (contrastRatio(candidate, background) >= target) {
      return candidate;
    }
    lightness += step;
  }

  const black = contrastRatio("#000000", background);
  const white = contrastRatio("#ffffff", background);
  if (black >= target) {
    return "#000000";
  }
  if (white >= target) {
    return "#ffffff";
  }
  return null;
}

function colorDistance(a: Rgb, b: Rgb): number {
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
}

/** 从图片像素中提取主色（去重后按出现频率排序） */
export function extractPalette(imageData: ImageData, count = 8): string[] {
  const buckets = new Map<number, { r: number; g: number; b: number; n: number }>();
  const total = imageData.width * imageData.height;
  const stride = Math.max(1, Math.floor(total / 6000));

  for (let index = 0; index < total; index += stride) {
    const offset = index * 4;
    const alpha = imageData.data[offset + 3];
    if (alpha < 128) {
      continue;
    }
    const r = imageData.data[offset];
    const g = imageData.data[offset + 1];
    const b = imageData.data[offset + 2];
    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
      bucket.n += 1;
    } else {
      buckets.set(key, { r, g, b, n: 1 });
    }
  }

  const ranked = [...buckets.values()]
    .sort((a, b) => b.n - a.n)
    .map((bucket) => ({
      r: Math.round(bucket.r / bucket.n),
      g: Math.round(bucket.g / bucket.n),
      b: Math.round(bucket.b / bucket.n),
    }));

  const selected: Rgb[] = [];
  for (const color of ranked) {
    if (selected.every((picked) => colorDistance(picked, color) > 42)) {
      selected.push(color);
    }
    if (selected.length >= count) {
      break;
    }
  }

  return selected.map(rgbToHex);
}
