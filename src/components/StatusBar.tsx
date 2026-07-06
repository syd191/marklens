import { Code2, MoreHorizontal, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { IconButton } from "./IconButton";
import type { AppStrings } from "../lib/i18n";
import type { SaveStatus } from "../types";

type StatusBarProps = {
  t: AppStrings;
  sidebarOpen: boolean;
  sourceMode: boolean;
  wordCount: number;
  saveStatus: SaveStatus;
  currentPath: string | null;
  onToggleSidebar: () => void;
  onToggleSource: () => void;
  onOpenMore: () => void;
};

export function StatusBar({
  t,
  sidebarOpen,
  sourceMode,
  wordCount,
  saveStatus,
  currentPath,
  onToggleSidebar,
  onToggleSource,
  onOpenMore
}: StatusBarProps) {
  const pathLabel = currentPath ?? t.status.noFile;
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
        <IconButton title={t.status.more} onClick={onOpenMore}>
          <MoreHorizontal size={18} strokeWidth={1.8} />
        </IconButton>
      </div>
      <div className="status-path" title={pathLabel}>
        {pathLabel}
      </div>
      <div className="status-right">
        {status && <span className={`save-state save-${saveStatus}`}>{status}</span>}
        <span>{t.status.words(wordCount)}</span>
      </div>
    </footer>
  );
}
