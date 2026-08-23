# MarkLens

语言：简体中文 | [English](README.en.md)

MarkLens 是一个面向 Windows 的免费开源 Markdown 编辑、维护与 EPUB 阅读工具。它提供类似 Typora 的 Markdown 编辑体验，同时保留可直接修改原文的源码模式；打开电子书时则切换为专注、舒适的阅读界面。

MarkLens 的核心体验是“正文优先”：默认隐藏侧栏，打开文档后先显示正文；需要导航时再打开大纲；需要浏览当前目录时再切到文件树。

## 下载

当前项目版本是 **v0.3.1**。已发布的 Windows 构建可从 [Releases 页面](https://github.com/syd191/marklens/releases) 下载；执行 `npm run dist` 时会生成：

- `MarkLens-Setup-0.3.1-x64.exe`：当前用户安装包。
- `MarkLens-0.3.1-x64.zip`：普通 ZIP 版，推荐公司内网分发。

> Windows 构建目前未进行代码签名，首次运行时可能出现 Microsoft Defender SmartScreen 提示。

## 界面截图

完整 Markdown 预览界面：

![MarkLens 完整 Markdown 预览界面](docs/screenshots/reading-night.png)

EPUB 夜间阅读界面：

![MarkLens EPUB 夜间阅读界面](docs/screenshots/epub-night.png)

## 功能

- 打开 `.md`、`.markdown`、`.txt` 和 `.epub` 文件；Windows 构建可关联 EPUB。
- 阅读未加密的 EPUB 2/3：支持重排版、固定版式、从右到左阅读和竖排书写。
- EPUB 阅读器提供目录、分页/滚动切换、字号调节、章节定位、进度拖动和阅读位置记忆；分页与固定版式可用鼠标滚轮或触控板翻页。
- 默认使用源码编辑器；普通 CommonMark/GFM 文档可切换到所见即所得编辑，高级语法使用完整文档预览。
- 自动生成文档大纲，并支持点击标题跳转。
- 侧栏提供大纲、文档列表/文件树和全文搜索。
- Files 页支持右键操作：打开文件位置、新建 MD 文件、新建文件夹、重命名文件和文件夹。
- 支持源码模式以及在所见即所得与 Markdown 原文之间往返切换。
- 完整的文件工作流：新建窗口、最近文件、另存为、移动、删除、保存全部、属性、HTML/PDF 导出与打印。
- 段落与格式命令：六级标题、列表、任务列表、表格、公式块、代码块、警告框、引用、链接、脚注、目录、Front Matter、粗体、斜体、下划线、删除线与行内代码。
- 支持查找替换、专注模式、打字机模式、状态栏、字数统计、全屏、窗口置顶和缩放。
- 粘贴或拖入本地图片时可保存到文档旁的 `assets` 目录。
- 自动保存默认关闭，用户必须在设置中主动开启。
- 支持 Github、Newsprint、Night、Pixyll、Whitey 和跟随系统主题。
- 自定义 HTML 菜单栏随主题动态换色，并保留全部快捷键。
- 默认跟随系统语言，内置简体中文、繁体中文和英文界面。
- 提供当前用户 NSIS、普通 ZIP、便携版和供 IT 部署的 per-machine MSI 构建方式。

## Markdown 支持

- GFM 表格和任务列表
- 代码高亮
- 本地和远程图片
- 链接
- KaTeX 数学公式
- Mermaid 图表
- 脚注
- 文档目录（`[TOC]` / `[[toc]]`）
- YAML Front Matter

## EPUB 支持与边界

- EPUB 解析由固定提交版本的 [foliate-js](https://github.com/johnfactotum/foliate-js) 提供，并通过 MarkLens 自己的适配层接入，减少上游接口变化对应用的影响。
- 保留出版物定义的阅读顺序、语言方向、竖排和固定版式；仅对可重排正文应用主题与字号。
- 分页和固定版式下，向下/向右滚动前进，向上/向左滚动后退；连续滚动模式保留原生滚动行为。
- EPUB 内脚本默认被内容安全策略禁用，外部链接只允许通过系统浏览器打开。
- 不支持 DRM、受加密保护的内容或依赖脚本交互的电子书；单个 EPUB 的安全读取上限为 512 MB。
- 损坏、缺少 `container.xml` / OPF 或伪装扩展名的文件会显示可操作的错误说明，不会停留在空白页。

## 性能设计

MarkLens 以快速打开和流畅浏览 Markdown 为目标：

- 主窗口立即显示主题背景，避免渲染失败时窗口永久隐藏；启动异常写入本地日志。
- 初始 HTML 会提前应用保存的主题或系统主题，减少主题闪烁。
- 富文本编辑器按需加载，启动源码模式时不载入 Lexical/MDXEditor 大包。
- EPUB 阅读器及 foliate-js 独立按需加载，编辑 Markdown 时不会进入首屏包。
- 公式、Mermaid、脚注、目录、Front Matter 和 HTML 使用整篇解析，保证文档级语义正确。
- 大纲默认延后生成，在需要时再计算。
- Mermaid 图表库按需加载，并逐块生成隔离 SVG。
- 文件树按目录懒加载，展开目录时再读取子项。

## 安全默认值

- Markdown 原始 HTML 经过 DOMPurify 清洗；安全标签保留，脚本和事件属性会被移除。
- Electron 开启 context isolation 和 sandbox。
- 文件访问限制在 Markdown 类文本文件和 EPUB；EPUB 以只读方式打开。
- EPUB 内容在隔离框架中呈现，严格 CSP 禁止出版物脚本执行，并限制对象、表单与网络能力。
- 自动保存是可选项，并在写入前严格检查文件修改时间，避免静默覆盖外部修改。
- 保存和自动刷新完成后会再次核对当前文档快照，避免异步操作覆盖用户刚输入的内容。

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

构建 Windows 安装包和普通 ZIP 版：

```bash
npm run dist
```

构建便携版使用 `npm run pack`；构建供 IT 部署的 per-machine MSI 使用 `npm run dist:enterprise`。

正式企业发布应通过 electron-builder 的 `CSC_LINK` / `CSC_KEY_PASSWORD` 配置代码签名，并设置 `$env:MARKLENS_REQUIRE_SIGNING="1"`，使未签名构建直接失败。

构建产物会输出到项目内的 `dist-build/`，同时生成包含哈希、签名状态和运行库检查结果的 `build-manifest.json`。

## 项目结构

- `electron/`：Electron 主进程和 preload 桥接。
- `src/components/`：React 界面组件。
- `src/components/RichMarkdownEditor.tsx`：所见即所得 Markdown 编辑器和编辑命令桥接。
- `src/components/SourceEditor.tsx`：源码编辑器、历史记录、查找和选区操作。
- `src/components/EpubReader.tsx`：EPUB 目录、版式、导航、主题与阅读进度界面。
- `src/lib/editorCommands.ts`：可测试的 Markdown 文本命令。
- `src/lib/markdown.ts`：严格 Front Matter 识别、大纲提取、兼容性分析、安全 HTML 和整篇文档渲染。
- `src/lib/i18n.ts`：简体中文、繁体中文、英文界面文案和语言解析。
- `assets/`：应用图标源文件。
- `docs/`：架构和维护说明。
- `CHANGELOG.md`：版本变更记录。

## 许可证

MIT。
