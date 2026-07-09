# MarkLens

MarkLens 是一个免费的开源 Markdown 维护工具，主要面向 Windows 用户。它适合阅读、整理、检查和轻量修改 `.md` 文件，不把整个界面做成复杂编辑器。

MarkLens 的核心体验是“正文优先”：默认隐藏侧栏，打开文档后先显示正文；需要导航时再打开大纲；需要浏览当前目录时再切到文件树。

## 下载

Windows 版本可在 [v0.1.0 Release](https://github.com/syd191/marklens/releases/tag/v0.1.0) 下载：

- `MarkLens.Setup.0.1.0.exe`：安装包。
- `MarkLens-0.1.0-x64-portable.exe`：便携版。

## 界面截图

正文优先的阅读界面：

![MarkLens 阅读界面](docs/screenshots/reading-night.png)

大纲优先的文档导航：

![MarkLens 大纲界面](docs/screenshots/outline-night.png)

当前文件所在目录浏览：

![MarkLens 文件界面](docs/screenshots/files-night.png)

## 功能

- 打开 `.md`、`.markdown` 和 `.txt` 文件。
- 默认显示干净的 Markdown 预览。
- 自动生成文档大纲，并支持点击标题跳转。
- Files 页默认显示当前 MD 文件所在目录，并选中当前文件。
- Files 页支持右键操作：打开文件位置、新建 MD 文件、新建文件夹、重命名文件和文件夹。
- 支持源码模式，用于轻量编辑。
- 自动保存默认关闭，用户必须在设置中主动开启。
- 支持导出当前文档为 HTML。
- 支持浅色、夜间、跟随系统主题。
- 默认跟随系统语言，内置简体中文和英文界面。

## Markdown 支持

- GFM 表格和任务列表
- 代码高亮
- 本地和远程图片
- 链接
- KaTeX 数学公式
- Mermaid 图表

## 性能设计

MarkLens 以快速打开和流畅浏览 Markdown 为目标：

- 主窗口等首屏 UI 准备好后再显示，减少启动白屏。
- 初始 HTML 会提前应用保存的主题或系统主题，减少主题闪烁。
- 长 Markdown 文档按块处理。
- 先渲染首屏内容，剩余内容在空闲时间继续渲染。
- 大纲默认延后生成，在需要时再计算。
- Mermaid 图表靠近可视区域后再渲染。
- 文件树按目录懒加载，展开目录时再读取子项。

## 安全默认值

- Markdown 中的原始 HTML 默认转义。
- Electron 开启 context isolation 和 sandbox。
- 文件访问限制在 Markdown 类文本文件。
- 自动保存是可选项，并在写入前检查文件修改时间，避免静默覆盖冲突。

## 开发

环境要求：

- Windows
- Node.js 22 或更新版本

安装依赖：

```bash
npm install
```

本地运行：

```bash
npm run dev
```

运行检查：

```bash
npm run check
```

构建 Windows 安装包和便携版：

```bash
npm run dist
```

构建产物会输出到项目目录上级的 `../../outputs`。

## 项目结构

- `electron/`：Electron 主进程和 preload 桥接。
- `src/components/`：React 界面组件。
- `src/lib/markdown.ts`：Markdown 分块、大纲提取和渲染。
- `src/lib/i18n.ts`：中英文界面文案和语言解析。
- `assets/`：应用图标源文件。
- `docs/`：架构和维护说明。

## 许可证

MIT。

---

## English

MarkLens is a free, open-source Markdown maintenance tool for Windows. It is designed for people who read, organize, review, and lightly update `.md` files without turning the whole screen into a complex editor.

MarkLens keeps the document first: the sidebar is hidden by default, the outline is the primary navigation surface, and the file tree appears only when it is useful.

### Download

Windows builds are available from the [v0.1.0 release](https://github.com/syd191/marklens/releases/tag/v0.1.0):

- `MarkLens.Setup.0.1.0.exe`: installer.
- `MarkLens-0.1.0-x64-portable.exe`: portable executable.

### Screenshots

Document-first reading view:

![MarkLens reading view](docs/screenshots/reading-night.png)

Outline-first navigation:

![MarkLens outline view](docs/screenshots/outline-night.png)

Current-folder file browsing:

![MarkLens files view](docs/screenshots/files-night.png)

### What It Does

- Opens `.md`, `.markdown`, and `.txt` files.
- Shows a clean Markdown preview by default.
- Generates a document outline and lets you jump between headings.
- Shows the current file's folder in the Files tab and selects the open file.
- Supports Files context actions: show in File Explorer, create MD file, create folder, rename files and folders.
- Supports source mode for light edits.
- Keeps auto save off by default; users must enable it explicitly.
- Exports the current document to HTML.
- Supports Light, Night, and Follow System themes.
- Follows the system language by default, with Simplified Chinese and English UI.

### Markdown Support

- GFM tables and task lists
- Code highlighting
- Local and remote images
- Links
- KaTeX math
- Mermaid diagrams

### Performance Approach

MarkLens is built to make opening and browsing Markdown feel immediate:

- The window waits until the first UI is ready before showing.
- The initial HTML shell applies the saved/system theme before React loads to reduce white flashes.
- Long Markdown files are split into chunks.
- The first chunks render first; remaining chunks render during idle time.
- Outline generation is deferred by default and runs when needed.
- Mermaid diagrams render near the viewport instead of during the first paint.
- The file tree scans lazily by directory.

### Safety Defaults

- Raw HTML inside Markdown is escaped.
- Electron context isolation and sandbox mode are enabled.
- File access is limited to Markdown-like text files.
- Auto save is opt-in and checks the file modification time before writing.

### Development

Requirements:

- Windows
- Node.js 22 or newer

Install dependencies:

```bash
npm install
```

Run locally:

```bash
npm run dev
```

Run checks:

```bash
npm run check
```

Build Windows installer and portable executable:

```bash
npm run dist
```

Build artifacts are written to `../../outputs` from this project folder.

### Project Structure

- `electron/`: Electron main process and preload bridge.
- `src/components/`: React UI components.
- `src/lib/markdown.ts`: Markdown chunking, outline extraction, and rendering.
- `src/lib/i18n.ts`: Chinese / English UI strings and language resolution.
- `assets/`: App icon source files.
- `docs/`: Architecture and maintenance notes.

### License

MIT.
