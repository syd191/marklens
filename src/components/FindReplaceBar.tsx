import { ChevronDown, ChevronUp, Replace, X } from "lucide-react";
import { useEffect, useRef } from "react";
import type { AppStrings } from "../lib/i18n";

type FindReplaceBarProps = {
  t: AppStrings;
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
  t,
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
    <section className="find-replace-bar" aria-label={t.findReplace.aria}>
      <div className="find-row">
        <input
          ref={inputRef}
          value={term}
          placeholder={t.findReplace.find}
          aria-label={t.findReplace.find}
          onChange={(event) => onTermChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onFind(event.shiftKey);
            if (event.key === "Escape") onClose();
          }}
        />
        <span className="find-count">{term ? t.findReplace.matchCount(matchCount) : ""}</span>
        <button type="button" title={t.findReplace.previous} onClick={() => onFind(true)}>
          <ChevronUp size={15} />
        </button>
        <button type="button" title={t.findReplace.next} onClick={() => onFind(false)}>
          <ChevronDown size={15} />
        </button>
        <button type="button" title={t.common.close} onClick={onClose}>
          <X size={15} />
        </button>
      </div>
      <div className="find-row">
        <input
          value={replacement}
          placeholder={t.findReplace.replaceWith}
          aria-label={t.findReplace.replaceWith}
          onChange={(event) => onReplacementChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onReplace();
            if (event.key === "Escape") onClose();
          }}
        />
        <button type="button" className="replace-button" title={t.findReplace.replace} onClick={onReplace}>
          <Replace size={14} /> {t.findReplace.replace}
        </button>
        <button type="button" className="replace-button" onClick={onReplaceAll}>
          {t.findReplace.replaceAll}
        </button>
      </div>
    </section>
  );
}
