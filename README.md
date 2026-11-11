# 折刀雀工具箱（folding-blade-toolbox）

一款本地优先的桌面多功能工具箱：图片压缩、尺寸调整、格式转换、二维码与颜色工具。图片处理由 Rust 后端完成，实用工具在浏览器端完成，所有文件都留在本机，不会上传到任何服务器。

当前版本：`0.1.0`

## 功能

### 图片

- **图片压缩**：批量压缩 JPG / PNG / GIF，可调质量与 PNG 有损量化，支持前后对比预览、单张下载与批量导出。
- **调整图片大小**：支持原始尺寸、按百分比、固定宽高、限制最长边、裁剪等多种模式，可批量处理。
- **格式转换**：JPG / PNG / GIF / SVG 互转，支持透明背景填充、PNG 颜色数控制与 SVG 栅格化缩放。

### 实用工具

- **二维码**：生成自定义内容与样式的二维码；支持从图片或摄像头识别二维码。
- **颜色工具**：调色盘与多格式互转、渐变生成、WCAG 对比度检查、图片取色，以及 Windows 下的屏幕取色。

## 技术栈

| 层       | 技术                                                                           |
| -------- | ------------------------------------------------------------------------------ |
| 桌面框架 | Tauri 2                                                                        |
| 前端     | Vue 3、TypeScript、Vue Router、Tailwind CSS 4、Vite                            |
| 图片处理 | Rust：`image`、`imagequant`、`oxipng`、`jpeg-encoder`、`resvg`、`kamadak-exif` |
| 二维码   | `uqr`（生成）、`jsqr`（识别）                                                  |
| 包管理   | Bun                                                                            |

## 环境要求

- [Bun](https://bun.sh/) 1.x（或使用 `npm` / `pnpm` 并相应替换命令）
- [Rust](https://www.rust-lang.org/tools/install) stable（`Cargo.toml` 使用 edition 2024，需 Rust 1.85+）
- [Tauri 2 系统依赖](https://tauri.app/start/prerequisites/)（Windows 需 WebView2 与 MSVC 构建工具）
- 屏幕取色功能仅支持 Windows

## 快速开始

```bash
# 安装前端依赖
bun install

# 启动桌面应用（开发模式，自动热更新）
bun tauri dev
```

也可以只启动前端进行界面预览：

```bash
bun run dev
```

浏览器模式下图片处理会回退到 Canvas 实现；屏幕取色、调用系统文件对话框等依赖 Tauri 的能力不可用。

## 常用脚本

| 命令                | 说明                             |
| ------------------- | -------------------------------- |
| `bun run dev`       | 启动 Vite 开发服务器             |
| `bun tauri dev`     | 启动 Tauri 桌面应用开发模式      |
| `bun run build`     | 类型检查并构建前端产物到 `dist/` |
| `bun tauri build`   | 构建各平台安装包                 |
| `bun run preview`   | 预览前端构建产物                 |
| `bun run typecheck` | 运行 `vue-tsc` 类型检查          |
| `bun run lint`      | 运行 oxlint 检查并自动修复       |
| `bun run format`    | 使用 oxfmt 格式化代码            |

## 构建安装包

```bash
bun tauri build
```

产物位于 `src-tauri/target/release/bundle/`，安装包名称与应用标识来自 [tauri.conf.json](src-tauri/tauri.conf.json)。

## 测试

Rust 图片处理逻辑带有单元测试：

```bash
cd src-tauri
cargo test
```

## 目录结构

```
.
├── src/                    # 前端源码
│   ├── components/         # 通用组件（拖拽区、文件列表、设置面板等）
│   ├── composables/        # 组合式函数（拖拽、Toast、最近颜色）
│   ├── lib/                # 图片处理、文件保存、剪贴板等工具
│   ├── stores/             # 各类任务队列状态
│   ├── views/              # 页面：首页 / 压缩 / 缩放 / 转换 / 二维码 / 颜色
│   └── router/             # 路由配置
├── src-tauri/              # Tauri + Rust 后端
│   ├── src/processor/      # 图片压缩、缩放、格式转换、EXIF、SVG、GIF 处理
│   ├── src/screen_picker.rs# 屏幕取色
│   ├── capabilities/       # Tauri 权限配置
│   └── tauri.conf.json     # 应用配置
└── public/                 # 静态资源与图标
```

## 隐私说明

- 图片压缩、缩放、转换均在本地完成，必要时通过 Tauri IPC 交给 Rust 处理。
- 不包含任何统计、遥测或远程上传逻辑。

## 推荐 IDE

- [VS Code](https://code.visualstudio.com/) + [Vue - Official](https://marketplace.visualstudio.com/items?itemName=Vue.volar) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

## 许可证

本项目基于 [MIT License](LICENSE) 开源，Copyright (c) 2026 Ben J.。
