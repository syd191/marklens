import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState, type MutableRefObject } from "react";
import {
  AdmonitionDirectiveDescriptor,
  CodeMirrorEditor,
  MDXEditor,
  activeEditor$,
  applyBlockType$,
  applyFormat$,
  applyListType$,
  codeBlockPlugin,
  codeMirrorPlugin,
  currentBlockType$,
  directivesPlugin,
  frontmatterPlugin,
  headingsPlugin,
  imagePlugin,
  insertCodeMirror$,
  insertDirective$,
  insertFrontmatter$,
  insertMarkdown$,
  insertTable$,
  insertThematicBreak$,
  linkDialogPlugin,
  linkPlugin,
  listsPlugin,
  markdownShortcutPlugin,
  openLinkEditDialog$,
  openNewImageDialog$,
  quotePlugin,
  tablePlugin,
  thematicBreakPlugin,
  toolbarPlugin,
  useCellValue,
  usePublisher,
  type MDXEditorMethods
} from "@mdxeditor/editor";
import {
  INDENT_CONTENT_COMMAND,
  OUTDENT_CONTENT_COMMAND,
  REDO_COMMAND,
  SELECT_ALL_COMMAND,
  UNDO_COMMAND
} from "lexical";
import { stripMarkdown } from "../lib/editorCommands";
import { encodeFileUrlPath } from "../lib/markdown";

export type RichMarkdownEditorHandle = {
  execute: (command: string) => boolean;
  focus: () => void;
};

type CommandChannel = {
  execute?: (command: string) => boolean;
};

type RichMarkdownEditorProps = {
  markdown: string;
  baseDirectory: string | null;
  fontSize: number;
  spellCheck: boolean;
  typewriterMode: boolean;
  onChange: (markdown: string) => void;
  onRequestSourceMode: () => void;
};

function resolveImageSource(source: string, baseDirectory: string | null) {
  if (!baseDirectory || /^(https?:|file:|data:|#)/i.test(source)) return source;
  const normalized = `${baseDirectory.replace(/\\/g, "/").replace(/\/$/, "")}/${source.replace(/^\.\//, "")}`;
  // 与 markdown.ts 的预览渲染保持一致的编码逻辑，避免已编码路径被二次编码（#9）
  return `file:///${encodeFileUrlPath(normalized)}`;
}

function RichCommandBridge({ channel }: { channel: MutableRefObject<CommandChannel> }) {
  const activeEditor = useCellValue(activeEditor$);
  const currentBlockType = useCellValue(currentBlockType$);
  const applyBlockType = usePublisher(applyBlockType$);
  const applyFormat = usePublisher(applyFormat$);
  const applyListType = usePublisher(applyListType$);
  const insertCode = usePublisher(insertCodeMirror$);
  const insertDirective = usePublisher(insertDirective$);
  const insertFrontmatter = usePublisher(insertFrontmatter$);
  const insertMarkdown = usePublisher(insertMarkdown$);
  const insertTable = usePublisher(insertTable$);
  const insertThematicBreak = usePublisher(insertThematicBreak$);
  const openLinkDialog = usePublisher(openLinkEditDialog$);
  const openImageDialog = usePublisher(openNewImageDialog$);

  useEffect(() => {
    channel.current.execute = (command) => {
      if (command === "undo") return Boolean(activeEditor?.dispatchCommand(UNDO_COMMAND, undefined));
      if (command === "redo") return Boolean(activeEditor?.dispatchCommand(REDO_COMMAND, undefined));
      if (command === "select-all") return Boolean(activeEditor?.dispatchCommand(SELECT_ALL_COMMAND, new KeyboardEvent("keydown")));
      if (command === "indent-list") return Boolean(activeEditor?.dispatchCommand(INDENT_CONTENT_COMMAND, undefined));
      if (command === "outdent-list") return Boolean(activeEditor?.dispatchCommand(OUTDENT_CONTENT_COMMAND, undefined));

      if (command.startsWith("heading-")) {
        applyBlockType(`h${command.slice(-1)}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6");
        return true;
      }
      if (command === "paragraph") {
        applyBlockType("paragraph");
        return true;
      }
      if (command === "quote") {
        applyBlockType("quote");
        return true;
      }
      if (command === "promote-heading" || command === "demote-heading") {
        const current = currentBlockType.startsWith("h") ? Number(currentBlockType.slice(1)) : 0;
        const delta = command === "promote-heading" ? -1 : 1;
        const next = Math.max(0, Math.min(6, current + delta));
        applyBlockType(next ? `h${next}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6" : "paragraph");
        return true;
      }

      const formats = {
        bold: "bold",
        italic: "italic",
        underline: "underline",
        "inline-code": "code",
        strikethrough: "strikethrough"
      } as const;
      if (command in formats) {
        applyFormat(formats[command as keyof typeof formats]);
        return true;
      }

      if (command === "ordered-list") {
        applyListType("number");
        return true;
      }
      if (command === "unordered-list") {
        applyListType("bullet");
        return true;
      }
      if (command === "task-list") {
        applyListType("check");
        return true;
      }
      if (command === "table") {
        insertTable({ rows: 3, columns: 3 });
        return true;
      }
      if (command === "code-block") {
        insertCode({ language: "text", code: "" });
        return true;
      }
      if (command === "warning") {
        insertDirective({ type: "containerDirective", name: "caution" });
        return true;
      }
      if (command === "horizontal-rule") {
        insertThematicBreak();
        return true;
      }
      if (command === "front-matter") {
        insertFrontmatter();
        return true;
      }
      if (command === "link") {
        openLinkDialog();
        return true;
      }
      if (command === "image") {
        openImageDialog();
        return true;
      }

      const snippets: Record<string, string> = {
        "math-block": "\n\n$$\n\n$$\n",
        comment: "<!-- comment -->",
        "insert-paragraph-above": "\n\n",
        "insert-paragraph-below": "\n\n",
        "link-reference": "[引用文本][ref]\n\n[ref]: https://",
        footnote: "[^1]\n\n[^1]: ",
        toc: "[TOC]\n"
      };
      if (command in snippets) {
        insertMarkdown(snippets[command]);
        return true;
      }
      return false;
    };
    return () => {
      channel.current.execute = undefined;
    };
  }, [
    activeEditor,
    applyBlockType,
    applyFormat,
    applyListType,
    channel,
    currentBlockType,
    insertCode,
    insertDirective,
    insertFrontmatter,
    insertMarkdown,
    insertTable,
    insertThematicBreak,
    openImageDialog,
    openLinkDialog
  ]);

  return null;
}

export const RichMarkdownEditor = forwardRef<RichMarkdownEditorHandle, RichMarkdownEditorProps>(function RichMarkdownEditor({
  markdown,
  baseDirectory,
  fontSize,
  spellCheck,
  typewriterMode,
  onChange,
  onRequestSourceMode
}, ref) {
  const [parseError, setParseError] = useState<string | null>(null);
  const editorRef = useRef<MDXEditorMethods>(null);
  const commandChannelRef = useRef<CommandChannel>({});
  const plugins = useMemo(() => [
    headingsPlugin(),
    listsPlugin(),
    quotePlugin(),
    thematicBreakPlugin(),
    linkPlugin(),
    linkDialogPlugin(),
    imagePlugin({
      imagePreviewHandler: async (source) => resolveImageSource(source, baseDirectory),
      imageUploadHandler: async (file) => {
        const result = await window.markdownBridge?.saveImage({
          directory: baseDirectory,
          name: file.name,
          data: await file.arrayBuffer()
        });
        if (!result?.ok || !result.markdownPath) {
          throw new Error(result?.reason ?? "Unable to save image");
        }
        return result.markdownPath;
      }
    }),
    tablePlugin(),
    codeBlockPlugin({
      defaultCodeBlockLanguage: "text",
      codeBlockEditorDescriptors: [
        { priority: -10, match: () => true, Editor: CodeMirrorEditor }
      ]
    }),
    codeMirrorPlugin({
      codeBlockLanguages: {
        text: "Plain Text",
        js: "JavaScript",
        jsx: "JavaScript (React)",
        ts: "TypeScript",
        tsx: "TypeScript (React)",
        json: "JSON",
        css: "CSS",
        html: "HTML",
        bash: "Shell",
        powershell: "PowerShell",
        python: "Python",
        mermaid: "Mermaid"
      }
    }),
    frontmatterPlugin(),
    directivesPlugin({ directiveDescriptors: [AdmonitionDirectiveDescriptor] }),
    markdownShortcutPlugin(),
    toolbarPlugin({
      toolbarContents: () => <RichCommandBridge channel={commandChannelRef} />
    })
  ], [baseDirectory]);

  useEffect(() => {
    setParseError(null);
    const currentMarkdown = editorRef.current?.getMarkdown();
    if (currentMarkdown !== undefined && currentMarkdown !== markdown) {
      editorRef.current?.setMarkdown(markdown);
    }
  }, [markdown]);

  useEffect(() => {
    if (!typewriterMode) return;
    const onSelectionChange = () => {
      const selection = window.getSelection();
      const node = selection?.anchorNode;
      const element = node instanceof Element ? node : node?.parentElement;
      const block = element?.closest(".rich-markdown-content > *");
      block?.scrollIntoView({ block: "center", behavior: "smooth" });
    };
    document.addEventListener("selectionchange", onSelectionChange);
    return () => document.removeEventListener("selectionchange", onSelectionChange);
  }, [typewriterMode]);

  useImperativeHandle(ref, () => ({
    execute(command: string) {
      if (command === "copy-markdown" || command === "copy-plain" || command === "copy-html") {
        const selection = editorRef.current?.getSelectionMarkdown();
        const markdownValue = selection || editorRef.current?.getMarkdown() || "";
        const output =
          command === "copy-plain"
            ? stripMarkdown(markdownValue)
            : command === "copy-html"
              ? editorRef.current?.getContentEditableHTML() || ""
              : markdownValue;
        void navigator.clipboard.writeText(output);
        return true;
      }
      if (command === "paste-plain") {
        void navigator.clipboard.readText().then((value) => editorRef.current?.insertMarkdown(value));
        return true;
      }
      return commandChannelRef.current.execute?.(command) ?? false;
    },
    focus() {
      editorRef.current?.focus();
    }
  }), []);

  if (parseError) {
    return (
      <main className="rich-editor-fallback">
        <div>
          <strong>此文档包含富文本模式暂时无法解析的语法。</strong>
          <span>{parseError}</span>
          <button type="button" onClick={onRequestSourceMode}>使用源码模式继续编辑</button>
        </div>
      </main>
    );
  }

  return (
    <main className={`rich-editor-shell${typewriterMode ? " is-typewriter" : ""}`} style={{ fontSize: `${fontSize}px` }}>
      <MDXEditor
        ref={editorRef}
        className="rich-markdown-editor"
        contentEditableClassName="rich-markdown-content"
        markdown={markdown}
        spellCheck={spellCheck}
        plugins={plugins}
        placeholder="开始输入 Markdown..."
        onChange={(value, initialNormalize) => {
          if (!initialNormalize && value !== markdown) onChange(value);
        }}
        onError={({ error }) => setParseError(error)}
      />
    </main>
  );
});
