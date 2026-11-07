export async function createSampleFile(name = "示例图片.jpg"): Promise<File> {
  const canvas = document.createElement("canvas");
  canvas.width = 1600;
  canvas.height = 1000;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas 不可用");
  }

  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, "#0b1020");
  gradient.addColorStop(0.55, "#4338ca");
  gradient.addColorStop(1, "#f472b6");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
  ctx.font = '800 96px system-ui, "Segoe UI", sans-serif';
  ctx.fillText("TOOLBOX", canvas.width / 2, 520);
  ctx.font = '500 30px system-ui, "Segoe UI", sans-serif';
  ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
  ctx.fillText("本地图片工具箱 · 示例图", canvas.width / 2, 582);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error("示例图片生成失败"))),
      "image/jpeg",
      0.92,
    );
  });

  return new File([blob], name, { type: "image/jpeg" });
}
