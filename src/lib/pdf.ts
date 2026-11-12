import { decodeImage } from "@/lib/image";

export type PdfPageSize = "a4" | "image";

export interface PdfOptions {
  pageSize: PdfPageSize;
  /** A4 页边距，单位毫米 */
  margin: number;
  /** JPEG 质量 1-100 */
  quality: number;
}

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const MAX_IMAGE_SIDE = 4000;

interface PdfImage {
  data: Uint8Array;
  width: number;
  height: number;
}

const encoder = new TextEncoder();

function toJpeg(blob: Blob, quality: number): Promise<PdfImage> {
  return decodeImage(blob).then(async (decoded) => {
    try {
      const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(decoded.width, decoded.height));
      const width = Math.max(1, Math.round(decoded.width * scale));
      const height = Math.max(1, Math.round(decoded.height * scale));

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) {
        throw new Error("Canvas 不可用");
      }
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
      context.imageSmoothingQuality = "high";
      context.drawImage(decoded.source, 0, 0, width, height);

      const jpeg = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (result) => (result ? resolve(result) : reject(new Error("图片编码失败"))),
          "image/jpeg",
          Math.min(1, Math.max(0.1, quality / 100)),
        );
      });

      return {
        data: new Uint8Array(await jpeg.arrayBuffer()),
        width,
        height,
      };
    } finally {
      decoded.dispose();
    }
  });
}

export async function imagesToPdf(blobs: Blob[], options: PdfOptions): Promise<Blob> {
  if (!blobs.length) {
    throw new Error("请先添加图片");
  }

  const images: PdfImage[] = [];
  for (const blob of blobs) {
    images.push(await toJpeg(blob, options.quality));
  }

  return buildPdf(images, options);
}

function pageLayout(
  image: PdfImage,
  options: PdfOptions,
): {
  pageWidth: number;
  pageHeight: number;
  drawWidth: number;
  drawHeight: number;
  x: number;
  y: number;
} {
  if (options.pageSize === "image") {
    const pageWidth = image.width * 0.75;
    const pageHeight = image.height * 0.75;
    return { pageWidth, pageHeight, drawWidth: pageWidth, drawHeight: pageHeight, x: 0, y: 0 };
  }

  const margin = Math.max(0, options.margin) * (72 / 25.4);
  const landscape = image.width > image.height;
  const pageWidth = landscape ? A4_HEIGHT : A4_WIDTH;
  const pageHeight = landscape ? A4_WIDTH : A4_HEIGHT;
  const boxWidth = Math.max(1, pageWidth - margin * 2);
  const boxHeight = Math.max(1, pageHeight - margin * 2);
  const scale = Math.min(boxWidth / image.width, boxHeight / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;

  return {
    pageWidth,
    pageHeight,
    drawWidth,
    drawHeight,
    x: (pageWidth - drawWidth) / 2,
    y: (pageHeight - drawHeight) / 2,
  };
}

function buildPdf(images: PdfImage[], options: PdfOptions): Blob {
  const chunks: BlobPart[] = [];
  let size = 0;

  const push = (data: string | Uint8Array): void => {
    const bytes = typeof data === "string" ? encoder.encode(data) : data;
    chunks.push(bytes as unknown as BlobPart);
    size += bytes.length;
  };

  const offsets: number[] = [];
  const beginObject = (id: number): void => {
    offsets[id] = size;
    push(`${id} 0 obj\n`);
  };
  const endObject = (): void => {
    push("endobj\n");
  };

  push("%PDF-1.4\n");

  const totalObjects = 2 + images.length * 3;

  beginObject(1);
  push("<< /Type /Catalog /Pages 2 0 R >>\n");
  endObject();

  const kids = images.map((_, index) => `${3 + index * 3} 0 R`).join(" ");
  beginObject(2);
  push(`<< /Type /Pages /Kids [${kids}] /Count ${images.length} >>\n`);
  endObject();

  images.forEach((image, index) => {
    const pageId = 3 + index * 3;
    const imageId = 4 + index * 3;
    const contentId = 5 + index * 3;
    const layout = pageLayout(image, options);

    beginObject(pageId);
    push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${layout.pageWidth.toFixed(2)} ${layout.pageHeight.toFixed(2)}]` +
        ` /Resources << /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>\n`,
    );
    endObject();

    beginObject(imageId);
    push(
      `<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height}` +
        ` /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.data.length} >>\nstream\n`,
    );
    push(image.data);
    push("\nendstream\n");
    endObject();

    const content =
      `q\n${layout.drawWidth.toFixed(2)} 0 0 ${layout.drawHeight.toFixed(2)} ` +
      `${layout.x.toFixed(2)} ${layout.y.toFixed(2)} cm\n/Im0 Do\nQ\n`;

    beginObject(contentId);
    push(`<< /Length ${encoder.encode(content).length} >>\nstream\n${content}endstream\n`);
    endObject();
  });

  const xrefOffset = size;
  push(`xref\n0 ${totalObjects + 1}\n`);
  push("0000000000 65535 f \n");
  for (let id = 1; id <= totalObjects; id += 1) {
    push(`${String(offsets[id]).padStart(10, "0")} 00000 n \n`);
  }
  push(`trailer\n<< /Size ${totalObjects + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

  return new Blob(chunks, { type: "application/pdf" });
}

export function pdfFileName(firstName?: string): string {
  if (!firstName) {
    return "images.pdf";
  }
  return `${firstName.replace(/\.[^.]+$/, "")}.pdf`;
}
