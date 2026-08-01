export type EditorSelection = {
  start: number;
  end: number;
};

export type EditorTransform = EditorSelection & {
  value: string;
};

export type MarkdownCommand =
  | `heading-${1 | 2 | 3 | 4 | 5 | 6}`
  | "paragraph"
  | "promote-heading"
  | "demote-heading"
  | "bold"
  | "italic"
  | "underline"
  | "inline-code"
  | "strikethrough"
  | "comment"
  | "link"
  | "image"
  | "clear-format"
  | "quote"
  | "ordered-list"
  | "unordered-list"
  | "task-list"
  | "indent-list"
  | "outdent-list"
  | "table"
  | "math-block"
  | "code-block"
  | "warning"
  | "insert-paragraph-above"
  | "insert-paragraph-below"
  | "link-reference"
  | "footnote"
  | "horizontal-rule"
  | "toc"
  | "front-matter";

const HEADING_RE = /^(#{1,6})\s+/;
const LIST_RE = /^(\s*)(?:(?:[-+*]|\d+\.)\s+(?:\[[ xX]\]\s+)?)/;

function selectedText(value: string, selection: EditorSelection) {
  return value.slice(selection.start, selection.end);
}

function replaceSelection(
  value: string,
  selection: EditorSelection,
  replacement: string,
  selectionOffset = 0,
  selectionLength = replacement.length
): EditorTransform {
  const next = `${value.slice(0, selection.start)}${replacement}${value.slice(selection.end)}`;
  const start = selection.start + selectionOffset;
  return { value: next, start, end: start + selectionLength };
}

function wrap(
  value: string,
  selection: EditorSelection,
  before: string,
  after: string,
  placeholder: string
): EditorTransform {
  const current = selectedText(value, selection);
  if (
    selection.start >= before.length &&
    value.slice(selection.start - before.length, selection.start) === before &&
    value.slice(selection.end, selection.end + after.length) === after
  ) {
    const nextSelection = {
      start: selection.start - before.length,
      end: selection.end + after.length
    };
    return replaceSelection(value, nextSelection, current, 0, current.length);
  }

  const content = current || placeholder;
  return replaceSelection(
    value,
    selection,
    `${before}${content}${after}`,
    before.length,
    content.length
  );
}

function lineRange(value: string, selection: EditorSelection) {
  const start = value.lastIndexOf("\n", Math.max(0, selection.start - 1)) + 1;
  const nextBreak = value.indexOf("\n", selection.end);
  const end = nextBreak === -1 ? value.length : nextBreak;
  return { start, end };
}

function transformLines(
  value: string,
  selection: EditorSelection,
  transform: (line: string, index: number) => string
): EditorTransform {
  const range = lineRange(value, selection);
  const source = value.slice(range.start, range.end);
  const next = source.split("\n").map(transform).join("\n");
  return replaceSelection(value, range, next, 0, next.length);
}

function setHeading(value: string, selection: EditorSelection, level: number): EditorTransform {
  return transformLines(value, selection, (line) => {
    const content = line.replace(HEADING_RE, "").trimStart();
    return level ? `${"#".repeat(level)} ${content}` : content;
  });
}

function changeHeading(value: string, selection: EditorSelection, direction: -1 | 1): EditorTransform {
  return transformLines(value, selection, (line) => {
    const match = line.match(HEADING_RE);
    const current = match?.[1].length ?? 0;
    const next = Math.max(0, Math.min(6, current + direction));
    const content = line.replace(HEADING_RE, "").trimStart();
    return next ? `${"#".repeat(next)} ${content}` : content;
  });
}

function prefixLines(
  value: string,
  selection: EditorSelection,
  prefix: (index: number) => string
): EditorTransform {
  return transformLines(value, selection, (line, index) => {
    const match = line.match(LIST_RE);
    const content = match ? line.slice(match[0].length) : line;
    return `${prefix(index)}${content}`;
  });
}

function insertBlock(
  value: string,
  selection: EditorSelection,
  block: string,
  cursorToken = "$CURSOR$"
): EditorTransform {
  const tokenIndex = block.indexOf(cursorToken);
  const cleanBlock = block.replace(cursorToken, "");
  const beforeNeedsBreak = selection.start > 0 && value[selection.start - 1] !== "\n";
  const afterNeedsBreak = selection.end < value.length && value[selection.end] !== "\n";
  const replacement = `${beforeNeedsBreak ? "\n\n" : ""}${cleanBlock}${afterNeedsBreak ? "\n\n" : ""}`;
  const cursor = (beforeNeedsBreak ? 2 : 0) + (tokenIndex >= 0 ? tokenIndex : cleanBlock.length);
  return replaceSelection(value, selection, replacement, cursor, 0);
}

function clearFormatting(value: string, selection: EditorSelection): EditorTransform {
  const range = selection.start === selection.end ? lineRange(value, selection) : selection;
  const current = value.slice(range.start, range.end);
  // 清理块级与行内格式，但保留图片和链接的语法结构（只去掉其行内格式），
  // 避免把 ![alt](url) 降级为纯文本 alt 导致图片丢失（#7）
  const clean = current
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/^(\s*)(?:[-+*]|\d+\.)\s+(?:\[[ xX]\]\s+)?/gm, "$1")
    .replace(/(\*\*|__|~~|`|<u>|<\/u>)/g, "")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1$2")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, url) => `[${text}](${url})`);
  return replaceSelection(value, range, clean, 0, clean.length);
}

export function applyMarkdownCommand(
  value: string,
  selection: EditorSelection,
  command: MarkdownCommand
): EditorTransform {
  if (command.startsWith("heading-")) {
    return setHeading(value, selection, Number(command.slice(-1)));
  }

  switch (command) {
    case "paragraph":
      return setHeading(value, selection, 0);
    case "promote-heading":
      return changeHeading(value, selection, -1);
    case "demote-heading":
      return changeHeading(value, selection, 1);
    case "bold":
      return wrap(value, selection, "**", "**", "粗体文本");
    case "italic":
      return wrap(value, selection, "*", "*", "斜体文本");
    case "underline":
      return wrap(value, selection, "<u>", "</u>", "下划线文本");
    case "inline-code":
      return wrap(value, selection, "`", "`", "code");
    case "strikethrough":
      return wrap(value, selection, "~~", "~~", "删除线文本");
    case "comment":
      return wrap(value, selection, "<!-- ", " -->", "注释");
    case "link":
      return wrap(value, selection, "[", "](https://)", "链接文本");
    case "image":
      return wrap(value, selection, "![", "](image.png)", "图片说明");
    case "clear-format":
      return clearFormatting(value, selection);
    case "quote":
      return transformLines(value, selection, (line) => (line.startsWith("> ") ? line.slice(2) : `> ${line}`));
    case "ordered-list":
      return prefixLines(value, selection, (index) => `${index + 1}. `);
    case "unordered-list":
      return prefixLines(value, selection, () => "- ");
    case "task-list":
      return prefixLines(value, selection, () => "- [ ] ");
    case "indent-list":
      return transformLines(value, selection, (line) => `  ${line}`);
    case "outdent-list":
      return transformLines(value, selection, (line) => line.replace(/^ {1,2}/, ""));
    case "table":
      return insertBlock(value, selection, "| 列 1 | 列 2 |\n| --- | --- |\n| $CURSOR$ |  |");
    case "math-block":
      return insertBlock(value, selection, "$$\n$CURSOR$\n$$");
    case "code-block":
      return insertBlock(value, selection, "```text\n$CURSOR$\n```");
    case "warning":
      return insertBlock(value, selection, "> [!WARNING]\n> $CURSOR$");
    case "insert-paragraph-above": {
      const range = lineRange(value, selection);
      return replaceSelection(value, { start: range.start, end: range.start }, "\n", 0, 0);
    }
    case "insert-paragraph-below": {
      const range = lineRange(value, selection);
      return replaceSelection(value, { start: range.end, end: range.end }, "\n", 1, 0);
    }
    case "link-reference":
      return insertBlock(value, selection, "[引用文本][ref]\n\n[ref]: https://$CURSOR$");
    case "footnote":
      return insertBlock(value, selection, "[^1]\n\n[^1]: $CURSOR$");
    case "horizontal-rule":
      return insertBlock(value, selection, "---\n$CURSOR$");
    case "toc":
      return insertBlock(value, selection, "[TOC]\n$CURSOR$");
    case "front-matter":
      return insertBlock(value, selection, "---\ntitle: $CURSOR$\ndate: \ntags: []\n---\n");
  }

  return { value, ...selection };
}

export function moveSelectedLines(
  value: string,
  selection: EditorSelection,
  direction: -1 | 1
): EditorTransform {
  const range = lineRange(value, selection);
  const before = value.slice(0, range.start);
  const current = value.slice(range.start, range.end);
  const after = value.slice(range.end);

  if (direction === -1) {
    if (!before) return { value, ...selection };
    const previousEnd = before.endsWith("\n") ? before.length - 1 : before.length;
    const previousStart = before.lastIndexOf("\n", Math.max(0, previousEnd - 1)) + 1;
    const previous = before.slice(previousStart, previousEnd);
    const prefix = before.slice(0, previousStart);
    const next = `${prefix}${current}\n${previous}${after}`;
    return { value: next, start: previousStart, end: previousStart + current.length };
  }

  if (!after.startsWith("\n")) return { value, ...selection };
  const nextEnd = after.indexOf("\n", 1);
  const followingEnd = nextEnd === -1 ? after.length : nextEnd;
  const following = after.slice(1, followingEnd);
  const suffix = after.slice(followingEnd);
  const next = `${before}${following}\n${current}${suffix}`;
  const start = range.start + following.length + 1;
  return { value: next, start, end: start + current.length };
}

export function stripMarkdown(value: string): string {
  return value
    .replace(/^---[\s\S]*?---\s*/m, "")
    .replace(/```(?:\w+)?\n([\s\S]*?)```/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/^(\s*)(?:[-+*]|\d+\.)\s+(?:\[[ xX]\]\s+)?/gm, "$1")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/(\*\*|__|~~|`|<u>|<\/u>)/g, "")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1$2");
}
