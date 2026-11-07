export interface DecodedImage {
  source: CanvasImageSource;
  width: number;
  height: number;
  dispose: () => void;
}

export async function decodeImage(blob: Blob): Promise<DecodedImage> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      dispose: () => bitmap.close(),
    };
  }
  return decodeWithImage(blob);
}

function decodeWithImage(blob: Blob): Promise<DecodedImage> {
  const url = URL.createObjectURL(blob);
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () =>
      resolve({
        source: image,
        width: image.naturalWidth,
        height: image.naturalHeight,
        dispose: () => URL.revokeObjectURL(url),
      });
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("无法解析图片"));
    };
    image.src = url;
  });
}
