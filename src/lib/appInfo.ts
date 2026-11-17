// 应用基础信息。版本号在构建时由 package.json 注入，发布前需与
// src-tauri/tauri.conf.json 保持一致（`bun run version:check` 会校验）。
export const APP_NAME = "折刀雀工具箱";
export const APP_VERSION = __APP_VERSION__;
export const APP_LICENSE = "MIT License";
export const REPO_URL = "https://github.com/BenJ-6/folding-blade-toolbox";
