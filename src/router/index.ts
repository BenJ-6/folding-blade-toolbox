import { createRouter, createWebHashHistory } from "vue-router";
import ColorView from "@/views/ColorView.vue";
import CompressView from "@/views/CompressView.vue";
import ConvertView from "@/views/ConvertView.vue";
import DevToolsView from "@/views/DevToolsView.vue";
import HomeView from "@/views/HomeView.vue";
import QrCodeView from "@/views/QrCodeView.vue";
import ResizeView from "@/views/ResizeView.vue";

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: "/", name: "home", component: HomeView },
    { path: "/compress", name: "compress", component: CompressView },
    { path: "/resize", name: "resize", component: ResizeView },
    { path: "/convert", name: "convert", component: ConvertView },
    { path: "/qrcode", name: "qrcode", component: QrCodeView },
    { path: "/color", name: "color", component: ColorView },
    { path: "/devtools", name: "devtools", component: DevToolsView },
  ],
});
