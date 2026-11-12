const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder("utf-8", { fatal: true });

function bytesToBinary(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return binary;
}

function binaryToBytes(binary: string): Uint8Array {
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function encodeBase64(value: string, urlSafe = false): string {
  const base64 = btoa(bytesToBinary(textEncoder.encode(value)));
  if (!urlSafe) {
    return base64;
  }
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function decodeBase64(value: string): string {
  const normalized = value
    .trim()
    .replace(/\s+/g, "")
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .replace(/=+$/g, "");

  if (!normalized) {
    throw new Error("没有可解码的内容");
  }
  if (!/^[A-Za-z0-9+/]+$/.test(normalized)) {
    throw new Error("包含 Base64 之外的字符");
  }

  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return textDecoder.decode(binaryToBytes(atob(padded)));
}

export interface JwtData {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  signature: string;
  headerJson: string;
  payloadJson: string;
}

export function decodeJwt(token: string): JwtData {
  const cleaned = token.trim().replace(/^Bearer\s+/i, "");
  const parts = cleaned.split(".");

  if (parts.length < 2) {
    throw new Error("JWT 至少需要「.」分隔的头部和载荷两段");
  }

  let headerJson = "";
  let payloadJson = "";

  try {
    headerJson = decodeBase64(parts[0]);
  } catch {
    throw new Error("头部不是有效的 Base64URL 编码");
  }
  try {
    payloadJson = decodeBase64(parts[1]);
  } catch {
    throw new Error("载荷不是有效的 Base64URL 编码");
  }

  let header: Record<string, unknown>;
  let payload: Record<string, unknown>;

  try {
    header = JSON.parse(headerJson) as Record<string, unknown>;
  } catch {
    throw new Error("头部解码后不是有效的 JSON");
  }
  try {
    payload = JSON.parse(payloadJson) as Record<string, unknown>;
  } catch {
    throw new Error("载荷解码后不是有效的 JSON");
  }

  return {
    header,
    payload,
    signature: parts[2] ?? "",
    headerJson: prettyJson(header),
    payloadJson: prettyJson(payload),
  };
}

export function prettyJson(value: unknown): string {
  return JSON.stringify(value, null, 2) ?? "";
}

function sortObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortObjectKeys);
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => [key, sortObjectKeys(item)]);
    return Object.fromEntries(entries);
  }
  return value;
}

export function formatJson(input: string, indent = 2, sortKeys = false): string {
  const parsed: unknown = JSON.parse(input);
  return JSON.stringify(sortKeys ? sortObjectKeys(parsed) : parsed, null, indent) ?? "";
}

export function describeJsonError(input: string, error: unknown): string {
  const message = error instanceof Error ? error.message : "无法解析 JSON";
  const match = /position (\d+)/i.exec(message);
  if (!match) {
    return message;
  }
  const position = Number(match[1]);
  const before = input.slice(0, position);
  const line = before.split("\n").length;
  const column = position - before.lastIndexOf("\n");
  return `第 ${line} 行第 ${column} 列附近存在语法错误`;
}

export function timestampInfo(
  ms: number,
  now = Date.now(),
): {
  local: string;
  utc: string;
  iso: string;
  relative: string;
} {
  const date = new Date(ms);
  return {
    local: date.toLocaleString("zh-CN", { hour12: false }),
    utc: date.toUTCString(),
    iso: date.toISOString(),
    relative: relativeTime(ms, now),
  };
}

export function relativeTime(ms: number, now = Date.now()): string {
  const diff = ms - now;
  const future = diff > 0;
  const seconds = Math.round(Math.abs(diff) / 1000);
  const suffix = future ? "后" : "前";

  if (seconds < 5) {
    return "刚刚";
  }
  if (seconds < 60) {
    return `${seconds} 秒${suffix}`;
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes} 分钟${suffix}`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} 小时${suffix}`;
  }

  const days = Math.floor(hours / 24);
  if (days < 30) {
    return `${days} 天${suffix}`;
  }

  const months = Math.floor(days / 30);
  if (months < 12) {
    return `${months} 个月${suffix}`;
  }

  return `${Math.floor(days / 365)} 年${suffix}`;
}

export function jwtSeconds(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value * 1000;
  }
  return null;
}

export type HashAlgorithm = "SHA-1" | "SHA-256" | "SHA-384" | "SHA-512";

export async function hashText(algorithm: HashAlgorithm, text: string): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error("当前环境不支持 Web Crypto，无法计算哈希");
  }
  const buffer = await globalThis.crypto.subtle.digest(algorithm, textEncoder.encode(text));
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
