import { createRouter, createWebHashHistory } from "vue-router";
import CompressView from "@/views/CompressView.vue";
import ResizeView from "@/views/ResizeView.vue";

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: "/", redirect: "/compress" },
    { path: "/compress", name: "compress", component: CompressView },
    { path: "/resize", name: "resize", component: ResizeView },
  ],
});
