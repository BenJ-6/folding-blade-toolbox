/// <reference types="vite/client" />

/** 构建时注入的应用版本号，来源为 package.json 的 version */
declare const __APP_VERSION__: string;

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<{}, {}, any>;
  export default component;
}
