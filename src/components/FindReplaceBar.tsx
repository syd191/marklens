import { ChevronDown, ChevronUp, Replace, X } from "lucide-react";
import { useEffect, useRef } from "react";

type FindReplaceBarProps = {
  open: boolean;
  term: string;
  replacement: string;
  matchCount: number;
  onTermChange: (value: string) => void;
  onReplacementChange: (value: string) => void;
  onFind: (backwards: boolean) => void;
  onReplace: () => void;
  onReplaceAll: () => void;
  onClose: () => void;
};

export function FindReplaceBar({
  open,
  term,
  replacement,
  matchCount,
  onTermChange,
  onReplacementChange,
  onFind,
  onReplace,
  onReplaceAll,
  onClose
}: FindReplaceBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) window.requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  if (!open) return null;

  return (
    <section className="find-replace-bar" aria-label="查找和替换">
      <div className="find-row">
        <input
          ref={inputRef}
          value={term}
          placeholder="查找"
          aria-label="查找"
          onChange={(event) => onTermChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onFind(event.shiftKey);
            if (event.key === "Escape") onClose();
          }}
        />
        <span className="find-count">{term ? `${matchCount} 处` : ""}</span>
        <button type="button" title="上一个" onClick={() => onFind(true)}>
          <ChevronUp size={15} />
        </button>
        <button type="button" title="下一个" onClick={() => onFind(false)}>
          <ChevronDown size={15} />
        </button>
        <button type="button" title="关闭" onClick={onClose}>
          <X size={15} />
        </button>
      </div>
      <div className="find-row">
        <input
          value={replacement}
          placeholder="替换为"
          aria-label="替换为"
          onChange={(event) => onReplacementChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onReplace();
            if (event.key === "Escape") onClose();
          }}
        />
        <button type="button" className="replace-button" title="替换" onClick={onReplace}>
          <Replace size={14} /> 替换
        </button>
        <button type="button" className="replace-button" onClick={onReplaceAll}>
          全部
        </button>
      </div>
    </section>
  );
}
