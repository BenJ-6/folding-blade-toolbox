import { createRouter, createWebHashHistory } from "vue-router";
import ColorView from "@/views/ColorView.vue";
import CompressView from "@/views/CompressView.vue";
import ConvertView from "@/views/ConvertView.vue";
import DevToolsView from "@/views/DevToolsView.vue";
import HomeView from "@/views/HomeView.vue";
import IconExtractView from "@/views/IconExtractView.vue";
import MetadataView from "@/views/MetadataView.vue";
import PdfView from "@/views/PdfView.vue";
import QrCodeView from "@/views/QrCodeView.vue";
import ResizeView from "@/views/ResizeView.vue";
import StitchView from "@/views/StitchView.vue";
import WatermarkView from "@/views/WatermarkView.vue";

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: "/", name: "home", component: HomeView },
    { path: "/compress", name: "compress", component: CompressView },
    { path: "/resize", name: "resize", component: ResizeView },
    { path: "/convert", name: "convert", component: ConvertView },
    { path: "/watermark", name: "watermark", component: WatermarkView },
    { path: "/pdf", name: "pdf", component: PdfView },
    { path: "/stitch", name: "stitch", component: StitchView },
    { path: "/metadata", name: "metadata", component: MetadataView },
    { path: "/qrcode", name: "qrcode", component: QrCodeView },
    { path: "/icon", name: "icon", component: IconExtractView },
    { path: "/color", name: "color", component: ColorView },
    { path: "/devtools", name: "devtools", component: DevToolsView },
  ],
});
