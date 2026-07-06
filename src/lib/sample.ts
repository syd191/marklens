import type { AppLanguage } from "../types";

const zhSample = `# MarkLens Markdown 阅读测试

## 快速浏览

MarkLens 是一个免费的 Markdown 阅读器，默认隐藏侧栏，让正文优先显示。点击左下角第一个按钮会打开大纲，切到“文件”后才显示文件树。

浏览体验的目标是：文件先出首屏，大纲、搜索索引、Mermaid 和数学公式在后台或接近可视区域时处理。

## 渲染能力

- 支持 GFM、表格、任务列表、代码高亮、图片和链接。
- 支持数学公式和 Mermaid 图表。
- 支持浅色、夜间、跟随系统主题。
- 源码编辑模式下可手动保存；自动保存默认关闭。

- [x] 快速显示首屏
- [x] 默认隐藏侧栏
- [ ] 打开大文件时继续优化滚动

| 文件 | 大小 | 状态 |
| --- | ---: | --- |
| README.md | 42 KB | 已就绪 |
| architecture.md | 1.8 MB | 已生成大纲 |
| long-report.md | 10 MB | 分块渲染 |

> 阅读界面应该安静：少工具栏、少干扰，把空间留给文档。

\`\`\`ts
async function openDocument(filePath: string) {
  renderFirstScreen(filePath);
  queueBackgroundOutline(filePath);
}
\`\`\`

## Mermaid 示例

\`\`\`mermaid
flowchart LR
  A[打开文件] --> B[显示首屏]
  B --> C[后台生成大纲]
  C --> D[懒渲染图表]
\`\`\`

## 数学公式

行内公式如 $E = mc^2$ 保持可读，块级公式居中显示：

$$
\\int_0^1 x^2 dx = \\frac{1}{3}
$$
`;

const enSample = `# MarkLens Markdown Reading Test

## Fast document browsing

MarkLens is a free Markdown reader that keeps the sidebar hidden by default so the document stays first. The bottom-left outline button opens the outline, and the Files tab reveals the file tree only when needed.

The browsing goal is simple: show the first screen quickly, then build outlines, search indexes, Mermaid diagrams, and math rendering in the background or near the viewport.

## Render support

- GFM, tables, task lists, code highlighting, images, and links.
- Math formulas and Mermaid diagrams.
- Light, Night, and Follow System themes.
- Source mode with manual save; auto save is off by default.

- [x] Render the first screen quickly
- [x] Keep the sidebar hidden by default
- [ ] Keep tuning long-document scrolling

| File | Size | Status |
| --- | ---: | --- |
| README.md | 42 KB | Ready |
| architecture.md | 1.8 MB | Outlined |
| long-report.md | 10 MB | Chunked |

> Reading should stay quiet: fewer controls, less distraction, more room for the document.

\`\`\`ts
async function openDocument(filePath: string) {
  renderFirstScreen(filePath);
  queueBackgroundOutline(filePath);
}
\`\`\`

## Mermaid example

\`\`\`mermaid
flowchart LR
  A[Open file] --> B[Render first screen]
  B --> C[Index outline]
  C --> D[Lazy diagrams]
\`\`\`

## Math example

Inline math such as $E = mc^2$ stays readable, and display math is centered:

$$
\\int_0^1 x^2 dx = \\frac{1}{3}
$$
`;

const samples: Record<AppLanguage, string> = {
  "zh-CN": zhSample,
  "en-US": enSample
};

export function getSampleMarkdown(language: AppLanguage) {
  return samples[language];
}

export function isSampleMarkdown(value: string) {
  return value === zhSample || value === enSample;
}
