import { createRouter, createWebHashHistory } from "vue-router";
import CompressView from "@/views/CompressView.vue";
import ConvertView from "@/views/ConvertView.vue";
import QrCodeView from "@/views/QrCodeView.vue";
import ResizeView from "@/views/ResizeView.vue";

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: "/", redirect: "/compress" },
    { path: "/compress", name: "compress", component: CompressView },
    { path: "/resize", name: "resize", component: ResizeView },
    { path: "/convert", name: "convert", component: ConvertView },
    { path: "/qrcode", name: "qrcode", component: QrCodeView },
  ],
});
