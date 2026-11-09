import { createImageQueue } from "@/composables/imageQueue";

export const compressQueue = createImageQueue({ pngLossy: true });
export const resizeQueue = createImageQueue({ quality: 92 });
