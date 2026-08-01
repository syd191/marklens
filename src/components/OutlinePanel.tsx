import { memo } from "react";
import type { AppStrings } from "../lib/i18n";
import type { OutlineItem } from "../types";

type OutlinePanelProps = {
  t: AppStrings;
  outline: OutlineItem[];
  onJump: (item: OutlineItem) => void;
};

// memo: 大纲仅在 outline 数组变化时重渲染，避免父组件搜索词等无关状态变化触发重渲染
export const OutlinePanel = memo(function OutlinePanel({ t, outline, onJump }: OutlinePanelProps) {
  if (!outline.length) {
    return <div className="empty-panel">{t.outline.empty}</div>;
  }

  return (
    <nav className="outline-list" aria-label={t.outline.aria}>
      {outline.map((item) => (
        <button
          type="button"
          key={`${item.id}-${item.line}`}
          className="outline-item"
          style={{ paddingLeft: `${12 + Math.max(0, item.level - 1) * 14}px` }}
          onClick={() => onJump(item)}
          title={t.outline.line(item.line)}
        >
          <span>{item.text}</span>
        </button>
      ))}
    </nav>
  );
});
