const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47];
const RT_ICON = 3;
const RT_GROUP_ICON = 14;

export const ICON_SOURCE_EXTENSIONS = ["exe", "dll", "ocx", "cpl", "ico", "icl"];

export interface IconAsset {
  index: number;
  group: number;
  width: number;
  height: number;
  bitCount: number;
  isPng: boolean;
  bytes: number;
  data: Uint8Array;
}

export interface ParsedIcons {
  assets: IconAsset[];
  format: "pe" | "ico";
}

interface ResourceEntry {
  id: number;
  offset: number;
  directory: boolean;
}

interface ResourceRange {
  start: number;
  size: number;
}

function u16(bytes: Uint8Array, offset: number): number {
  if (offset < 0 || offset + 2 > bytes.length) {
    throw new Error("文件数据不完整");
  }
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function u32(bytes: Uint8Array, offset: number): number {
  if (offset < 0 || offset + 4 > bytes.length) {
    throw new Error("文件数据不完整");
  }
  return (
    (bytes[offset] |
      (bytes[offset + 1] << 8) |
      (bytes[offset + 2] << 16) |
      (bytes[offset + 3] << 24)) >>>
    0
  );
}

function i32(bytes: Uint8Array, offset: number): number {
  return u32(bytes, offset) | 0;
}

function u32be(bytes: Uint8Array, offset: number): number {
  if (offset < 0 || offset + 4 > bytes.length) {
    throw new Error("文件数据不完整");
  }
  return (
    ((bytes[offset] << 24) |
      (bytes[offset + 1] << 16) |
      (bytes[offset + 2] << 8) |
      bytes[offset + 3]) >>>
    0
  );
}

function hasPngSignature(data: Uint8Array): boolean {
  return data.length >= 8 && PNG_MAGIC.every((value, index) => data[index] === value);
}

function isIco(bytes: Uint8Array): boolean {
  if (bytes.length < 6) {
    return false;
  }
  const type = u16(bytes, 2);
  return u16(bytes, 0) === 0 && (type === 1 || type === 2);
}

function toArrayBuffer(data: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(data.byteLength);
  new Uint8Array(buffer).set(data);
  return buffer;
}

function makeAsset(
  index: number,
  group: number,
  data: Uint8Array,
  bitCount: number,
  fallbackWidth: number,
  fallbackHeight: number,
): IconAsset {
  const png = hasPngSignature(data);
  let width = fallbackWidth;
  let height = fallbackHeight;

  if (png && data.length >= 24) {
    width = u32be(data, 16);
    height = u32be(data, 20);
  } else if (data.length >= 16) {
    const headerWidth = i32(data, 4);
    const headerHeight = i32(data, 8);
    if (headerWidth > 0) {
      width = headerWidth;
    }
    if (headerHeight > 0) {
      height = Math.max(1, Math.floor(headerHeight / 2));
    }
  }

  const depth = bitCount || (png ? 32 : data.length >= 16 ? u16(data, 14) : 0);

  return {
    index,
    group,
    width: width || fallbackWidth,
    height: height || fallbackHeight,
    bitCount: depth,
    isPng: png,
    bytes: data.length,
    data,
  };
}

function resourceEntries(bytes: Uint8Array, base: number, offset: number): ResourceEntry[] {
  const header = base + offset;
  const named = u16(bytes, header + 12);
  const ids = u16(bytes, header + 14);
  const total = named + ids;
  const entries: ResourceEntry[] = [];

  for (let i = 0; i < total; i += 1) {
    const entry = header + 16 + i * 8;
    const name = u32(bytes, entry);
    if (name & 0x8000_0000) {
      continue;
    }
    const target = u32(bytes, entry + 4);
    entries.push({
      id: name,
      offset: target & 0x7fff_ffff,
      directory: (target & 0x8000_0000) !== 0,
    });
  }

  return entries;
}

function resourceRange(
  bytes: Uint8Array,
  base: number,
  resourceRva: number,
  offset: number,
): ResourceRange {
  const entry = base + offset;
  const start = base + (u32(bytes, entry) - resourceRva);
  const size = u32(bytes, entry + 4);
  if (start < 0 || size < 0 || start + size > bytes.length) {
    throw new Error("图标资源数据越界");
  }
  return { start, size };
}

function collectIcons(bytes: Uint8Array, base: number, resourceRva: number) {
  const root = resourceEntries(bytes, base, 0);
  const iconType = root.find((entry) => entry.id === RT_ICON && entry.directory);
  const groupType = root.find((entry) => entry.id === RT_GROUP_ICON && entry.directory);
  const images = new Map<number, ResourceRange>();

  if (iconType) {
    for (const nameEntry of resourceEntries(bytes, base, iconType.offset)) {
      if (!nameEntry.directory) {
        continue;
      }
      const language = resourceEntries(bytes, base, nameEntry.offset).find(
        (entry) => !entry.directory,
      );
      if (language) {
        images.set(nameEntry.id, resourceRange(bytes, base, resourceRva, language.offset));
      }
    }
  }

  const assets: IconAsset[] = [];

  if (groupType) {
    let group = 0;
    for (const groupEntry of resourceEntries(bytes, base, groupType.offset)) {
      if (!groupEntry.directory) {
        continue;
      }
      const language = resourceEntries(bytes, base, groupEntry.offset).find(
        (entry) => !entry.directory,
      );
      if (!language) {
        group += 1;
        continue;
      }

      const groupData = resourceRange(bytes, base, resourceRva, language.offset);
      const count = u16(bytes, groupData.start + 4);
      for (let i = 0; i < count; i += 1) {
        const entry = groupData.start + 6 + i * 14;
        if (entry + 14 > bytes.length) {
          break;
        }
        const image = images.get(u16(bytes, entry + 12));
        if (!image) {
          continue;
        }
        assets.push(
          makeAsset(
            assets.length,
            group,
            bytes.subarray(image.start, image.start + image.size),
            u16(bytes, entry + 6),
            bytes[entry] || 256,
            bytes[entry + 1] || 256,
          ),
        );
      }
      group += 1;
    }
  }

  if (!assets.length) {
    for (const image of images.values()) {
      assets.push(
        makeAsset(assets.length, 0, bytes.subarray(image.start, image.start + image.size), 0, 0, 0),
      );
    }
  }

  return assets;
}

function readPe(bytes: Uint8Array): IconAsset[] {
  if (bytes.length < 0x40 || u16(bytes, 0) !== 0x5a4d) {
    throw new Error("不是有效的 Windows 可执行文件");
  }

  const peOffset = u32(bytes, 0x3c);
  if (u32(bytes, peOffset) !== 0x0000_4550) {
    throw new Error("不是有效的 PE 文件");
  }

  const coff = peOffset + 4;
  const sectionCount = u16(bytes, coff + 2);
  const optionalSize = u16(bytes, coff + 16);
  const optional = coff + 20;
  const magic = u16(bytes, optional);
  const directory = magic === 0x10b ? optional + 96 : magic === 0x20b ? optional + 112 : -1;
  if (directory < 0) {
    throw new Error("不支持的 PE 格式");
  }

  const resourceRva = u32(bytes, directory + 16);
  const resourceSize = u32(bytes, directory + 20);
  if (!resourceRva || !resourceSize) {
    throw new Error("该文件中没有内嵌图标");
  }

  const sectionTable = optional + optionalSize;
  let resourceBase = -1;
  for (let i = 0; i < sectionCount; i += 1) {
    const base = sectionTable + i * 40;
    if (base + 40 > bytes.length) {
      break;
    }
    const virtualSize = u32(bytes, base + 8);
    const virtualAddress = u32(bytes, base + 12);
    const rawSize = u32(bytes, base + 16);
    const rawPointer = u32(bytes, base + 20);
    const span = Math.max(virtualSize, rawSize);
    if (resourceRva >= virtualAddress && resourceRva < virtualAddress + span) {
      resourceBase = rawPointer + (resourceRva - virtualAddress);
      break;
    }
  }

  if (resourceBase < 0) {
    throw new Error("未找到资源段");
  }

  const assets = collectIcons(bytes, resourceBase, resourceRva);
  if (!assets.length) {
    throw new Error("该文件中没有内嵌图标");
  }
  return assets;
}

function readIco(bytes: Uint8Array): IconAsset[] {
  const count = u16(bytes, 4);
  const assets: IconAsset[] = [];

  for (let i = 0; i < count; i += 1) {
    const entry = 6 + i * 16;
    if (entry + 16 > bytes.length) {
      break;
    }
    const size = u32(bytes, entry + 8);
    const offset = u32(bytes, entry + 12);
    if (offset + size > bytes.length) {
      continue;
    }
    assets.push(
      makeAsset(
        assets.length,
        0,
        bytes.subarray(offset, offset + size),
        u16(bytes, entry + 6),
        bytes[entry] || 256,
        bytes[entry + 1] || 256,
      ),
    );
  }

  if (!assets.length) {
    throw new Error("该文件中没有可用的图标");
  }
  return assets;
}

export function parseIconAssets(bytes: Uint8Array): ParsedIcons {
  if (isIco(bytes)) {
    return { assets: readIco(bytes), format: "ico" };
  }
  return { assets: readPe(bytes), format: "pe" };
}

export function isIconSourceExtension(name: string): boolean {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return ICON_SOURCE_EXTENSIONS.includes(ext);
}

interface DecodedDib {
  width: number;
  height: number;
  rgba: Uint8ClampedArray<ArrayBuffer>;
}

function readPaletteIndex(data: Uint8Array, row: number, x: number, bitCount: number): number {
  if (bitCount === 8) {
    return data[row + x];
  }
  if (bitCount === 4) {
    const byte = data[row + (x >> 1)];
    return (x & 1) === 0 ? byte >> 4 : byte & 0x0f;
  }
  const byte = data[row + (x >> 3)];
  return (byte >> (7 - (x & 7))) & 1;
}

export function decodeDib(data: Uint8Array): DecodedDib {
  if (data.length < 40) {
    throw new Error("图标数据不完整");
  }

  const headerSize = u32(data, 0);
  if (headerSize < 40) {
    throw new Error("不支持的图标位图格式");
  }

  const width = i32(data, 4);
  const doubledHeight = i32(data, 8);
  const bitCount = u16(data, 14);
  const compression = u32(data, 16);
  const colorsUsed = u32(data, 32);

  if (width <= 0 || width > 1024 || doubledHeight <= 0) {
    throw new Error("图标尺寸异常");
  }
  if (compression !== 0) {
    throw new Error("不支持的图标压缩方式");
  }
  if (![1, 4, 8, 24, 32].includes(bitCount)) {
    throw new Error(`不支持的色深：${bitCount} 位`);
  }

  const height = Math.max(1, Math.floor(doubledHeight / 2));
  let pixelOffset = headerSize;
  let palette: Uint8Array | null = null;

  if (bitCount <= 8) {
    const colors = colorsUsed || 1 << bitCount;
    if (pixelOffset + colors * 4 > data.length) {
      throw new Error("图标调色板数据损坏");
    }
    palette = data.subarray(pixelOffset, pixelOffset + colors * 4);
    pixelOffset += colors * 4;
  }

  const stride = Math.floor((width * bitCount + 31) / 32) * 4;
  const maskStride = Math.floor((width + 31) / 32) * 4;
  const pixelBytes = stride * height;
  if (pixelOffset + pixelBytes > data.length) {
    throw new Error("图标像素数据不完整");
  }

  const maskOffset = pixelOffset + pixelBytes;
  const hasMask = maskOffset + maskStride * height <= data.length;

  let hasAlpha = false;
  if (bitCount === 32) {
    for (let offset = pixelOffset + 3; offset < pixelOffset + pixelBytes; offset += 4) {
      if (data[offset] !== 0) {
        hasAlpha = true;
        break;
      }
    }
  }

  const rgba = new Uint8ClampedArray(new ArrayBuffer(width * height * 4));

  for (let y = 0; y < height; y += 1) {
    const row = pixelOffset + (height - 1 - y) * stride;
    const maskRow = maskOffset + (height - 1 - y) * maskStride;

    for (let x = 0; x < width; x += 1) {
      let red = 0;
      let green = 0;
      let blue = 0;
      let alpha = 255;

      if (bitCount === 32) {
        const pixel = row + x * 4;
        blue = data[pixel];
        green = data[pixel + 1];
        red = data[pixel + 2];
        alpha = hasAlpha ? data[pixel + 3] : 255;
      } else if (bitCount === 24) {
        const pixel = row + x * 3;
        blue = data[pixel];
        green = data[pixel + 1];
        red = data[pixel + 2];
      } else {
        const entry = readPaletteIndex(data, row, x, bitCount) * 4;
        if (!palette || entry + 3 > palette.length) {
          throw new Error("图标调色板越界");
        }
        blue = palette[entry];
        green = palette[entry + 1];
        red = palette[entry + 2];
      }

      if (hasMask && (bitCount !== 32 || !hasAlpha)) {
        const transparent = (data[maskRow + (x >> 3)] >> (7 - (x & 7))) & 1;
        if (transparent) {
          alpha = 0;
        }
      }

      const target = (y * width + x) * 4;
      rgba[target] = red;
      rgba[target + 1] = green;
      rgba[target + 2] = blue;
      rgba[target + 3] = alpha;
    }
  }

  return { width, height, rgba };
}

export async function iconAssetToPng(asset: IconAsset): Promise<Blob> {
  if (asset.isPng) {
    return new Blob([toArrayBuffer(asset.data)], { type: "image/png" });
  }

  const decoded = decodeDib(asset.data);
  const canvas = document.createElement("canvas");
  canvas.width = decoded.width;
  canvas.height = decoded.height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("无法创建绘图上下文");
  }
  context.putImageData(new ImageData(decoded.rgba, decoded.width, decoded.height), 0, 0);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) {
    throw new Error("PNG 编码失败");
  }
  return blob;
}

export function buildIcoBlob(assets: IconAsset[]): Blob {
  const directorySize = 6 + assets.length * 16;
  const total = directorySize + assets.reduce((sum, asset) => sum + asset.data.length, 0);
  const buffer = new ArrayBuffer(total);
  const out = new Uint8Array(buffer);

  out[2] = 1;
  out[4] = assets.length & 0xff;
  out[5] = (assets.length >> 8) & 0xff;

  let offset = directorySize;
  assets.forEach((asset, index) => {
    const entry = 6 + index * 16;
    out[entry] = asset.width >= 256 ? 0 : asset.width;
    out[entry + 1] = asset.height >= 256 ? 0 : asset.height;
    out[entry + 4] = 1;
    const depth = asset.bitCount || 32;
    out[entry + 6] = depth & 0xff;
    out[entry + 7] = (depth >> 8) & 0xff;

    const size = asset.data.length;
    out[entry + 8] = size & 0xff;
    out[entry + 9] = (size >> 8) & 0xff;
    out[entry + 10] = (size >> 16) & 0xff;
    out[entry + 11] = (size >> 24) & 0xff;

    out[entry + 12] = offset & 0xff;
    out[entry + 13] = (offset >> 8) & 0xff;
    out[entry + 14] = (offset >> 16) & 0xff;
    out[entry + 15] = (offset >> 24) & 0xff;

    out.set(asset.data, offset);
    offset += size;
  });

  return new Blob([buffer], { type: "image/x-icon" });
}
