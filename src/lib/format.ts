export function formatBytes(bytes?: number | null): string {
  if (bytes == null || !Number.isFinite(bytes)) {
    return "—";
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`;
  }
  const mb = kb / 1024;
  if (mb < 1024) {
    return `${mb < 10 ? mb.toFixed(2) : mb.toFixed(1)} MB`;
  }
  return `${(mb / 1024).toFixed(2)} GB`;
}

export function formatDims(width?: number, height?: number): string {
  return width && height ? `${width}×${height}` : "读取中…";
}

export function savedPercent(before: number, after: number): number {
  if (!before) {
    return 0;
  }
  return Math.round((1 - after / before) * 100);
}
