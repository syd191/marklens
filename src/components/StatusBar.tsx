import { memo } from "react";
import { Code2, Focus, PanelLeftClose, PanelLeftOpen, TextCursorInput } from "lucide-react";
import { IconButton } from "./IconButton";
import type { AppStrings } from "../lib/i18n";
import type { SaveStatus } from "../types";

type StatusBarProps = {
  t: AppStrings;
  sidebarOpen: boolean;
  sourceMode: boolean;
  focusMode: boolean;
  typewriterMode: boolean;
  wordCount: number;
  line: number;
  column: number;
  zoom: number;
  saveStatus: SaveStatus;
  currentName: string | null;
  onToggleSidebar: () => void;
  onToggleSource: () => void;
  onToggleFocus: () => void;
  onToggleTypewriter: () => void;
  onOpenWordCount: () => void;
  onZoomChange: (zoom: number) => void;
};

// memo: 光标移动会高频更新 cursor 状态，但只有 line/column 变化时才需重渲染状态栏；
// 其余无关状态变化（如文档内容）不应触发状态栏重渲染
export const StatusBar = memo(function StatusBar({
  t,
  sidebarOpen,
  sourceMode,
  focusMode,
  typewriterMode,
  wordCount,
  line,
  column,
  zoom,
  saveStatus,
  currentName,
  onToggleSidebar,
  onToggleSource,
  onToggleFocus,
  onToggleTypewriter,
  onOpenWordCount,
  onZoomChange
}: StatusBarProps) {
  const fileLabel = currentName ?? t.status.noFile;
  const status = t.status.save[saveStatus];

  return (
    <footer className="status-bar">
      <div className="status-left">
        <IconButton title={sidebarOpen ? t.status.hideOutline : t.status.showOutline} active={sidebarOpen} onClick={onToggleSidebar}>
          {sidebarOpen ? <PanelLeftClose size={18} strokeWidth={1.8} /> : <PanelLeftOpen size={18} strokeWidth={1.8} />}
        </IconButton>
        <IconButton title={sourceMode ? t.status.returnPreview : t.status.sourceMode} active={sourceMode} onClick={onToggleSource}>
          <Code2 size={18} strokeWidth={1.8} />
        </IconButton>
        <IconButton title="专注模式 (F8)" active={focusMode} onClick={onToggleFocus}>
          <Focus size={17} strokeWidth={1.8} />
        </IconButton>
        <IconButton title="打字机模式 (F9)" active={typewriterMode} onClick={onToggleTypewriter}>
          <TextCursorInput size={17} strokeWidth={1.8} />
        </IconButton>
      </div>
      <div className="status-path">
        {fileLabel}
      </div>
      <div className="status-right">
        {status && <span className={`save-state save-${saveStatus}`}>{status}</span>}
        <span>行 {line}，列 {column}</span>
        <button type="button" className="status-text-button" onClick={onOpenWordCount}>{t.status.words(wordCount)}</button>
        <select
          className="status-zoom"
          aria-label="缩放"
          value={zoom}
          onChange={(event) => onZoomChange(Number(event.target.value))}
        >
          {[75, 90, 100, 110, 125, 150, 175, 200].map((value) => <option key={value} value={value}>{value}%</option>)}
        </select>
      </div>
    </footer>
  );
});
