# 折刀雀工具箱（folding-blade-toolbox）

一款本地优先的桌面多功能工具箱：图片压缩、尺寸调整、格式转换、批量加水印、图片转 PDF、长图拼接、图片信息、二维码、颜色工具、图标提取与开发工具。图片处理由 Rust 后端完成，实用工具在浏览器端完成，所有文件都留在本机，不会上传到任何服务器。

当前版本：`0.1.2`

## 功能

### 图片

- **图片压缩**：批量压缩 JPG / PNG / GIF，可按质量或目标体积（自动搜索最高画质），支持 PNG 有损量化、前后对比预览、单张下载与批量导出。
- **调整图片大小**：支持原始尺寸、按百分比、固定宽高、限制最长边、裁剪等多种模式，可批量处理。
- **格式转换**：JPG / PNG / GIF / SVG 互转，支持透明背景填充、PNG 颜色数控制与 SVG 栅格化缩放。
- **批量加水印**：文字或 Logo 水印，支持九宫格定位、平铺、旋转、透明度与字号比例调节。
- **图片转 PDF**：多图按顺序合并为 PDF，支持 A4 / 跟随图片两种页面尺寸、页边距与画质设置。
- **长图拼接**：按顺序拼成纵向长图、横向长图或网格拼图，支持间距与背景色。
- **图片信息**：查看尺寸、体积与 EXIF 字段，可一键清除 EXIF / XMP / 文本等元数据并另存。

### 实用工具

- **二维码**：生成自定义内容与样式的二维码；支持从图片或摄像头识别二维码。
- **颜色工具**：调色盘与多格式互转、渐变生成、WCAG 对比度检查、图片取色，以及 Windows 下的屏幕取色。
- **图标提取**：从 EXE / DLL / OCX / CPL 等 PE 文件与 ICO / ICL 中读取资源段内的全部图标，按原始尺寸预览（含透明通道），可单独导出 PNG、复制到剪贴板或导出完整 ICO。

### 开发

- **开发工具**：JWT 解析（展示头部、载荷与过期状态）、JSON 格式化 / 压缩 / 键名排序、Base64 与 URL 编解码、时间戳与日期互转、SHA-1 / SHA-256 / SHA-384 / SHA-512 哈希计算。

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
| `bun run version:check` | 校验三处版本号保持一致       |
| `bun run release:bump` | 同步版本号、跑测试并本地提交          |
| `bun run release:tag` | 校验版本号、打标签并推送            |
| `bun run lint`      | 运行 oxlint 检查并自动修复       |
| `bun run format`    | 使用 oxfmt 格式化代码            |

## 构建安装包

```bash
bun tauri build
```

产物位于 `src-tauri/target/release/bundle/`，安装包名称与应用标识来自 [tauri.conf.json](src-tauri/tauri.conf.json)。

安装包只产出 NSIS（`bundle.targets` 为 `["nsis"]`），因为应用内更新以 NSIS 安装器为更新载体。

由于开启了 `bundle.createUpdaterArtifacts`，构建时会同时生成 `.exe.sig` 签名文件；**未提供签名私钥时构建会直接失败**：

```powershell
$env:TAURI_SIGNING_PRIVATE_KEY="私钥内容或私钥文件路径"
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD="私钥密码"
bun tauri build
```

## 应用内更新

入口在侧边栏底部的「关于」面板里：显示当前版本，并提供「检查更新 → 下载更新 → 立即重启安装」的完整流程。应用启动 4 秒后会静默检查一次，有新版本时「关于」按钮右上角出现一个小圆点。

### 首次配置

1. 生成密钥对（只需一次）：

   ```powershell
   bun tauri signer generate -w $HOME/.tauri/folding-blade-toolbox.key
   ```

2. 把生成的**公钥内容**整段填入 [tauri.conf.json](src-tauri/tauri.conf.json) 的 `plugins.updater.pubkey`（不能填文件路径）。
3. 在仓库 Settings → Environments 新建环境 `release`：
   - Required reviewers 勾选自己，Deployment branches and tags 选 “Selected branches and tags” 并添加 **Tag** 规则 `v*`（下拉框注意切到 Tag，不要选 Branch）。
   - 在该环境下添加 Secrets：`TAURI_SIGNING_PRIVATE_KEY`、`TAURI_SIGNING_PRIVATE_KEY_PASSWORD`（不设密码可省略后者）。

> 签名密钥存放在 Environment secrets 而不是 Repository secrets，是为了让发布必须经过审批，其他 workflow 也读不到私钥。私钥丢失后，已安装的用户将无法再收到更新；请离线备份，不要提交到仓库。

### 发布新版本（推荐）

发版拆成两步：先在本地把版本号改对并提交，确认无误后再打标签推送。第一步可以反复重来，不会污染远端。

```powershell
# 1. 同步版本号 → 校验 → 类型检查 + cargo test → 本地提交
bun run release:bump          # 默认 patch：0.1.0 → 0.1.1
bun run release:bump minor    # 0.1.1 → 0.2.0
bun run release:bump 0.2.3    # 指定版本

# 2. 校验版本号与标签一致 → 打标签 → 推送，触发流水线
bun run release:tag
```

- `release:bump` 要求工作区干净，并会同步五处版本号（`package.json`、`Cargo.toml`、`Cargo.lock`、`tauri.conf.json`、README），提交信息为 `chore: release vX.Y.Z`。
- `release:tag` 会重新读取 `package.json` 推导标签，校验三处版本号一致且标签未被占用，然后推送分支与标签。
- 常用选项：`--dry-run` 预览、`-y` 跳过确认；`release:bump` 还支持 `--no-test`，`release:tag` 支持 `--no-push`（只建本地标签）。

推送后到 Actions 页面审批环境部署，等构建完成，再到 Releases 页面把草稿 Release **手动发布**（不发布的话客户端拿不到更新）。

### 手动发布

1. 同步修改三处版本号：`package.json`、`src-tauri/Cargo.toml`、`src-tauri/tauri.conf.json`（应用内更新以 `tauri.conf.json` 为准）。
2. 运行 `bun run version:check` 确认一致。
3. 提交并打标签：`git tag v0.1.1 && git push origin v0.1.1`。
4. [release.yml](.github/workflows/release.yml) 会构建 NSIS 安装包、签名并创建草稿 Release；在 GitHub 上发布该 Release 后，`latest.json` 才会对已安装用户生效。

### 注意事项

- Windows 上执行安装时应用会被强制退出，因此有批量图片任务正在运行时「立即重启安装」会被禁用。
- 仅支持由 NSIS 安装的实例；用 MSI 或便携版运行的用户需要手动下载安装包。
- 更新端点默认为 GitHub Releases，如需国内加速可在 `plugins.updater.endpoints` 中追加镜像地址（按顺序回退）。

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
│   ├── views/              # 页面：首页 / 压缩 / 缩放 / 转换 / 水印 / PDF / 拼接 / 信息 / 二维码 / 颜色 / 图标提取 / 开发工具
│   └── router/             # 路由配置
├── src-tauri/              # Tauri + Rust 后端
│   ├── src/processor/      # 图片压缩、缩放、格式转换、EXIF、SVG、GIF 处理
│   ├── src/metadata.rs     # EXIF 读取与元数据清理
│   ├── src/stitch.rs       # 长图拼接
│   ├── src/screen_picker.rs# 屏幕取色
│   ├── capabilities/       # Tauri 权限配置
│   └── tauri.conf.json     # 应用配置
├── scripts/                # 构建期脚本（版本号校验）
├── .github/workflows/      # 发布流水线
└── public/                 # 静态资源与图标
```

## 隐私说明

- 图片压缩、缩放、转换均在本地完成，必要时通过 Tauri IPC 交给 Rust 处理。
- 唯一的对外请求来自应用内更新：访问 GitHub Releases 获取版本清单与安装包，不携带任何本地文件或个人信息。
- 不包含任何统计、遥测或远程上传逻辑。

## 推荐 IDE

- [VS Code](https://code.visualstudio.com/) + [Vue - Official](https://marketplace.visualstudio.com/items?itemName=Vue.volar) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

## 许可证

本项目基于 [MIT License](LICENSE) 开源，Copyright (c) 2026 Ben J.。
