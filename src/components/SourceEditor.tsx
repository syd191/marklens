import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react";
import {
  applyMarkdownCommand,
  moveSelectedLines,
  stripMarkdown,
  type MarkdownCommand
} from "../lib/editorCommands";
import { renderMarkdownDocument } from "../lib/markdown";

export type CursorPosition = {
  start: number;
  end: number;
  line: number;
  column: number;
};

export type SourceEditorHandle = {
  execute: (command: string) => void;
  focus: () => void;
  findNext: (term: string, backwards?: boolean) => boolean;
  replaceCurrent: (term: string, replacement: string) => boolean;
  selectRange: (start: number, end: number) => void;
};

type SourceEditorProps = {
  value: string;
  baseDirectory: string | null;
  fontSize: number;
  spellCheck: boolean;
  typewriterMode: boolean;
  onChange: (value: string) => void;
  onCursorChange: (position: CursorPosition) => void;
};

function getCursorPosition(value: string, start: number, end: number): CursorPosition {
  const before = value.slice(0, start);
  const lines = before.split("\n");
  return {
    start,
    end,
    line: lines.length,
    column: (lines.at(-1)?.length ?? 0) + 1
  };
}

export const SourceEditor = forwardRef<SourceEditorHandle, SourceEditorProps>(function SourceEditor(
  { value, baseDirectory, fontSize, spellCheck, typewriterMode, onChange, onCursorChange },
  ref
) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const undoStackRef = useRef<string[]>([]);
  const redoStackRef = useRef<string[]>([]);
  // rAF 句柄，用于节流 onSelect 高频触发的光标回调，避免大文档拖选时频繁 split
  const cursorRafRef = useRef<number | null>(null);

  const reportCursor = useCallback(() => {
    // 用 rAF 合并同一帧内多次 onSelect/onClick/onKeyUp，只在下一帧计算一次光标位置
    if (cursorRafRef.current !== null) return;
    cursorRafRef.current = window.requestAnimationFrame(() => {
      cursorRafRef.current = null;
      const target = textareaRef.current;
      if (!target) return;
      const currentValue = target.value;
      onCursorChange(getCursorPosition(currentValue, target.selectionStart, target.selectionEnd));

      if (typewriterMode) {
        const lineHeight = Math.max(13, fontSize - 1) * 1.62;
        const line = currentValue.slice(0, target.selectionStart).split("\n").length - 1;
        target.scrollTop = Math.max(0, line * lineHeight - target.clientHeight * 0.45);
      }
    });
  }, [fontSize, onCursorChange, typewriterMode]);

  // 卸载时取消可能挂起的 rAF
  useEffect(() => () => {
    if (cursorRafRef.current !== null) window.cancelAnimationFrame(cursorRafRef.current);
  }, []);

  const selectRange = useCallback((start: number, end: number) => {
    window.requestAnimationFrame(() => {
      const target = textareaRef.current;
      if (!target) return;
      target.focus();
      target.setSelectionRange(start, end);
      onCursorChange(getCursorPosition(target.value, start, end));
    });
  }, [onCursorChange]);

  const commit = useCallback((next: string, start: number, end: number, recordHistory = true) => {
    if (next === value) {
      selectRange(start, end);
      return;
    }
    if (recordHistory) {
      undoStackRef.current.push(value);
      // 上限 100：大文档下全量快照占内存，100 步已足够覆盖常规撤销需求
      if (undoStackRef.current.length > 100) undoStackRef.current.shift();
      redoStackRef.current = [];
    }
    onChange(next);
    selectRange(start, end);
  }, [onChange, selectRange, value]);

  const runMarkdownCommand = useCallback((command: MarkdownCommand) => {
    const target = textareaRef.current;
    if (!target) return;
    const result = applyMarkdownCommand(value, {
      start: target.selectionStart,
      end: target.selectionEnd
    }, command);
    commit(result.value, result.start, result.end);
  }, [commit, value]);

  const findNext = useCallback((term: string, backwards = false) => {
    const target = textareaRef.current;
    if (!target || !term) return false;
    const source = value.toLocaleLowerCase();
    const needle = term.toLocaleLowerCase();
    const from = backwards ? Math.max(0, target.selectionStart - 1) : target.selectionEnd;
    let index = backwards ? source.lastIndexOf(needle, from) : source.indexOf(needle, from);
    if (index < 0) index = backwards ? source.lastIndexOf(needle) : source.indexOf(needle);
    if (index < 0) return false;
    selectRange(index, index + term.length);
    return true;
  }, [selectRange, value]);

  const replaceCurrent = useCallback((term: string, replacement: string) => {
    const target = textareaRef.current;
    if (!target || !term) return false;
    const current = value.slice(target.selectionStart, target.selectionEnd);
    if (current.toLocaleLowerCase() !== term.toLocaleLowerCase()) {
      return findNext(term);
    }
    const next = `${value.slice(0, target.selectionStart)}${replacement}${value.slice(target.selectionEnd)}`;
    const cursor = target.selectionStart + replacement.length;
    commit(next, cursor, cursor);
    return true;
  }, [commit, findNext, value]);

  const execute = useCallback((command: string) => {
    const target = textareaRef.current;
    if (!target) return;

    if (command === "undo") {
      const previous = undoStackRef.current.pop();
      if (previous === undefined) return;
      redoStackRef.current.push(value);
      // 注意：undo 不清空 redo 栈（标准 undo/redo 语义），后续新输入才会清空。
      // 光标定位到 previous 内容范围内，避免越界。
      const cursor = Math.min(previous.length, target.selectionStart);
      onChange(previous);
      selectRange(cursor, cursor);
      return;
    }
    if (command === "redo") {
      const next = redoStackRef.current.pop();
      if (next === undefined) return;
      undoStackRef.current.push(value);
      const cursor = Math.min(next.length, target.selectionStart);
      onChange(next);
      selectRange(cursor, cursor);
      return;
    }
    if (command === "select-all") {
      selectRange(0, value.length);
      return;
    }
    if (command === "select-line") {
      const start = value.lastIndexOf("\n", Math.max(0, target.selectionStart - 1)) + 1;
      const nextBreak = value.indexOf("\n", target.selectionEnd);
      const end = nextBreak === -1 ? value.length : nextBreak;
      selectRange(start, end);
      return;
    }
    if (command === "move-line-up" || command === "move-line-down") {
      const result = moveSelectedLines(value, {
        start: target.selectionStart,
        end: target.selectionEnd
      }, command === "move-line-up" ? -1 : 1);
      commit(result.value, result.start, result.end);
      return;
    }
    if (command === "delete") {
      const start = target.selectionStart;
      const end = target.selectionEnd;
      if (start !== end) commit(`${value.slice(0, start)}${value.slice(end)}`, start, start);
      return;
    }
    if (command === "delete-line") {
      const start = value.lastIndexOf("\n", Math.max(0, target.selectionStart - 1)) + 1;
      const nextBreak = value.indexOf("\n", target.selectionEnd);
      const end = nextBreak === -1 ? value.length : nextBreak + 1;
      commit(`${value.slice(0, start)}${value.slice(end)}`, start, start);
      return;
    }
    if (command === "copy-markdown" || command === "copy-plain" || command === "copy-html") {
      const source = value.slice(target.selectionStart, target.selectionEnd) || value;
      const output =
        command === "copy-plain"
          ? stripMarkdown(source)
          : command === "copy-html"
            ? renderMarkdownDocument(source, baseDirectory)
            : source;
      void navigator.clipboard.writeText(output);
      return;
    }
    if (command === "paste-plain") {
      void navigator.clipboard.readText().then((text) => {
        const start = target.selectionStart;
        const end = target.selectionEnd;
        const next = `${value.slice(0, start)}${text}${value.slice(end)}`;
        commit(next, start + text.length, start + text.length);
      });
      return;
    }
    if (command === "smart-punctuation") {
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const rangeStart = start === end ? 0 : start;
      const rangeEnd = start === end ? value.length : end;
      const source = value.slice(rangeStart, rangeEnd);
      const nextSource = source
        .replace(/(^|[\s([{])"([^"\n]+)"/g, "$1“$2”")
        .replace(/(^|[\s([{])'([^'\n]+)'/g, "$1‘$2’")
        .replace(/\.{3}/g, "…")
        .replace(/--/g, "—");
      commit(
        `${value.slice(0, rangeStart)}${nextSource}${value.slice(rangeEnd)}`,
        rangeStart,
        rangeStart + nextSource.length
      );
      return;
    }
    if (command === "normalize-line-endings") {
      const next = value.replace(/\r\n?/g, "\n");
      commit(next, Math.min(target.selectionStart, next.length), Math.min(target.selectionEnd, next.length));
      return;
    }
    if (command === "trim-whitespace") {
      const next = value.replace(/[ \t]+$/gm, "").replace(/\n{3,}/g, "\n\n");
      commit(next, Math.min(target.selectionStart, next.length), Math.min(target.selectionEnd, next.length));
      return;
    }

    runMarkdownCommand(command as MarkdownCommand);
  }, [baseDirectory, commit, onChange, runMarkdownCommand, selectRange, value]);

  useImperativeHandle(ref, () => ({
    execute,
    focus: () => textareaRef.current?.focus(),
    findNext,
    replaceCurrent,
    selectRange
  }), [execute, findNext, replaceCurrent, selectRange]);

  return (
    <main className={`source-shell${typewriterMode ? " is-typewriter" : ""}`}>
      <textarea
        ref={textareaRef}
        className="source-editor"
        spellCheck={spellCheck}
        value={value}
        style={{ fontSize: `${Math.max(13, fontSize - 1)}px` }}
        onChange={(event) => {
          if (event.target.value !== value) {
            undoStackRef.current.push(value);
            if (undoStackRef.current.length > 100) undoStackRef.current.shift();
            redoStackRef.current = [];
          }
          onChange(event.target.value);
        }}
        onClick={reportCursor}
        onKeyUp={reportCursor}
        onSelect={reportCursor}
        onKeyDown={(event) => {
          if (event.key !== "Tab") return;
          event.preventDefault();
          const target = event.currentTarget;
          const start = target.selectionStart;
          const end = target.selectionEnd;
          const next = `${value.slice(0, start)}  ${value.slice(end)}`;
          commit(next, start + 2, start + 2);
        }}
      />
    </main>
  );
});
