import { createImageQueue } from "@/composables/imageQueue";

export const compressQueue = createImageQueue({ pngLossy: true });
export const resizeQueue = createImageQueue({ quality: 92 });
export const convertQueue = createImageQueue({ targetFormat: "png", suffix: "" });

/** 是否有批量处理任务正在运行（安装更新会强制退出应用，需据此禁用“立即安装”） */
export function isAnyQueueBusy(): boolean {
  return (
    compressQueue.processing.value || resizeQueue.processing.value || convertQueue.processing.value
  );
}
