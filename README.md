# MD Reader

一款 macOS 原生 Markdown 阅读器，基于 Electron + React + TypeScript 构建。支持打开文件夹浏览目录树、双模式预览（渲染预览 / 原始 Markdown）。

![MD Reader](build/icon.icns)

## 功能特性

- **文件夹浏览** — 打开文件夹后自动扫描所有 `.md` / `.markdown` 文件，生成目录树
- **文件树侧边栏** — 递归展示目录结构，点击文件即可阅读
- **双预览模式** — Preview（渲染后的 HTML）和 Markdown（原始文本）一键切换
- **GFM 支持** — 表格、任务列表、删除线等 GitHub Flavored Markdown 语法
- **代码高亮** — 基于 highlight.js 的自动语法高亮
- **macOS 原生菜单** — File 菜单支持 Open Folder / Open File，含快捷键
- **工具栏按钮** — 顶部工具栏一键打开文件夹

## 项目架构

```
md-reader/
├── electron/                  # Electron 主进程
│   ├── main.ts                # 主进程入口：窗口创建、菜单、IPC handlers、文件扫描
│   └── preload.ts             # 预加载脚本：contextBridge 暴露 electronAPI
├── src/                       # 渲染进程（React）
│   ├── main.tsx               # React 入口
│   ├── App.tsx                # 主组件：状态管理 + 布局
│   ├── index.css              # 全局样式 + Markdown 渲染样式
│   ├── vite-env.d.ts          # electronAPI TypeScript 类型声明
│   └── components/
│       ├── FileTree.tsx       # 文件树组件（递归 TreeNode）
│       └── MarkdownViewer.tsx # Markdown 查看器（Preview / Markdown 双模式）
├── build/
│   └── icon.icns              # 应用图标（macOS .icns 格式）
├── index.html                 # Vite 入口 HTML
├── vite.config.ts             # Vite + Electron 构建配置
├── tailwind.config.js         # Tailwind CSS 配置
├── postcss.config.js          # PostCSS 配置
├── tsconfig.json              # TypeScript 配置
└── package.json               # 项目配置 + electron-builder 打包配置
```

## 核心技术栈

| 层级 | 技术 | 用途 |
|------|------|------|
| 框架 | Electron 35 | 桌面应用壳 |
| 前端 | React 18 + TypeScript 5 | UI 渲染 |
| 构建 | Vite 5 + vite-plugin-electron | 开发 & 打包 |
| 样式 | Tailwind CSS 3 + @tailwindcss/typography | UI + Markdown 排版 |
| Markdown | react-markdown + remark-gfm + rehype-highlight | 解析 & 渲染 |
| 代码高亮 | highlight.js | 代码块语法着色 |

## IPC 通信架构

应用采用 Electron 标准的 **主进程 ↔ 预加载 ↔ 渲染进程** 三层通信架构：

```
┌─────────────────┐     IPC Channel      ┌──────────────────┐     contextBridge     ┌─────────────────┐
│   Main Process   │ ◄──────────────────► │    Preload Script │ ◄───────────────────► │ Renderer (React) │
│   (electron/)    │   ipcMain.handle()   │  (preload.ts)     │  window.electronAPI  │   (src/)         │
│                  │   webContents.send() │                   │                      │                 │
└─────────────────┘                       └──────────────────┘                       └─────────────────┘
```

### IPC 通道一览

| 通道名 | 方向 | 类型 | 用途 |
|--------|------|------|------|
| `select-folder` | 渲染→主 | invoke/handle | 弹出选择文件夹对话框，返回路径 |
| `select-file` | 渲染→主 | invoke/handle | 弹出选择文件对话框，返回路径 |
| `read-folder` | 渲染→主 | invoke/handle | 扫描目录，返回文件树 `{ ok, tree, path }` |
| `read-file` | 渲染→主 | invoke/handle | 读取文件，返回内容 `{ ok, content }` |
| `menu:open-folder` | 主→渲染 | send/on | 菜单点击"Open Folder"后通知渲染进程 |
| `menu:open-file` | 主→渲染 | send/on | 菜单点击"Open File"后通知渲染进程 |

### 菜单事件流

菜单点击后的数据流：

```
用户点击菜单 → main.ts 弹出 dialog → 获取路径
            → webContents.send('menu:open-folder', path)
            → preload.ts 转发为 onMenuOpenFolder(path)
            → App.tsx useEffect 回调 → setFolderPath + readFolder
```

关键设计：菜单回调在 `useEffect(() => { ... }, [])` 中直接处理，使用 `useState` setter（跨渲染稳定）而非 `useCallback` 引用，避免闭包过时问题。

## 代码说明

### `electron/main.ts` — 主进程

- **窗口创建** — 1400×900 默认尺寸，启用 `contextIsolation`，禁用 `nodeIntegration`
- **菜单构建** — File 菜单含 Open Folder (`Cmd+Shift+O`) 和 Open File (`Cmd+O`)
- **IPC handlers** — `select-folder` / `select-file` 调用原生 `dialog.showOpenDialog`；`read-folder` / `read-file` 读取本地文件系统
- **文件扫描** — `scanDir()` 递归扫描目录，过滤 `.md` / `.markdown` 文件，跳过 `.` 开头的隐藏目录，遇到权限不足的目录静默跳过
- **生产模式路径** — `__dirname` 为 `dist-electron/main/`，`index.html` 路径为 `../../dist/index.html`

### `electron/preload.ts` — 预加载脚本

通过 `contextBridge.exposeInMainWorld` 将 IPC 操作封装为 `window.electronAPI`，渲染进程无法直接访问 Node.js / Electron API。

### `src/App.tsx` — 主组件

- **状态管理** — `folderPath`、`fileTree`、`selectedFile`、`content`、`viewMode`、`loading`、`error`
- **菜单事件** — 两个独立 `useEffect` 分别监听 `onMenuOpenFolder` 和 `onMenuOpenFile`，依赖为 `[]` 保证只注册一次
- **工具栏** — "Open Folder" 按钮通过 `selectFolder()` IPC 弹出对话框
- **文件树点击** — 点击 `.md` 文件调用 `readFile` IPC 加载内容
- **双模式切换** — Preview / Markdown 按钮切换 `viewMode` 状态

### `src/components/FileTree.tsx` — 文件树

- **递归组件** — `TreeNode` 递归渲染目录和文件
- **展开/折叠** — 点击目录切换展开状态，默认展开
- **选中高亮** — 当前选中文件以蓝色背景高亮
- **排序** — 目录优先，同类型按名称排序（由主进程 `scanDir` 保证）

### `src/components/MarkdownViewer.tsx` — Markdown 查看器

- **Preview 模式** — `react-markdown` + `remark-gfm` + `rehype-highlight` 渲染
- **Markdown 模式** — 原始文本 `<pre>` 展示
- **滚动复位** — 内容切换时自动滚动到顶部

## 开发

### 环境要求

- Node.js >= 18
- macOS（当前仅支持 macOS）

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

启动后自动打开 Electron 窗口，Vite 开发服务器支持热更新。

### 构建打包

```bash
# 构建并打包 DMG（x64 + arm64）
npm run build

# 仅构建 macOS
npm run build:mac
```

产出目录：`release/`

| 文件 | 说明 |
|------|------|
| `MD Reader-1.0.0-arm64.dmg` | Apple Silicon (M1/M2/M3) 安装包 |
| `MD Reader-1.0.0.dmg` | Intel (x64) 安装包 |
| `MD Reader-1.0.0-arm64-mac.zip` | Apple Silicon 免安装包 |
| `MD Reader-1.0.0-mac.zip` | Intel 免安装包 |

## 安装与运行

1. 双击 DMG 文件
2. 将 **MD Reader** 拖入 **Applications** 文件夹
3. 从 Applications 或 Launchpad 启动

> **注意**：请勿直接从 DMG 窗口运行应用，macOS 可能因签名/沙盒限制导致崩溃（SIGBUS）。务必先复制到 `/Applications`。

### 调试模式

从终端启动可查看主进程日志：

```bash
/Applications/MD\ Reader.app/Contents/MacOS/MD\ Reader
```

终端会输出 IPC 通信日志，例如：

```
[main] Open Folder dialog result: {"canceled":false,"filePaths":["/Users/xxx/docs"]}
[main] Sending menu:open-folder with path: /Users/xxx/docs
[main] read-folder result for /Users/xxx/docs - tree items: 12
```

## 应用图标

图标位于 `build/icon.icns`，为蓝色渐变圆角方形 + `#M` 文字设计。

重新生成图标的方法：

```bash
# 1. 准备一个 1024x1024 的 PNG
# 2. 生成 iconset
mkdir MyIcon.iconset
sips -z 16 16     icon.png --out MyIcon.iconset/icon_16x16.png
sips -z 32 32     icon.png --out MyIcon.iconset/icon_16x16@2x.png
sips -z 32 32     icon.png --out MyIcon.iconset/icon_32x32.png
sips -z 64 64     icon.png --out MyIcon.iconset/icon_32x32@2x.png
sips -z 128 128   icon.png --out MyIcon.iconset/icon_128x128.png
sips -z 256 256   icon.png --out MyIcon.iconset/icon_128x128@2x.png
sips -z 256 256   icon.png --out MyIcon.iconset/icon_256x256.png
sips -z 512 512   icon.png --out MyIcon.iconset/icon_256x256@2x.png
sips -z 512 512   icon.png --out MyIcon.iconset/icon_512x512.png
sips -z 1024 1024 icon.png --out MyIcon.iconset/icon_512x512@2x.png

# 3. 生成 icns
iconutil -c icns MyIcon.iconset -o build/icon.icns
```

## License

MIT
