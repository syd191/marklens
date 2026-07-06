import { FileCode2, FolderOpen, Settings, X } from "lucide-react";
import type { MouseEvent } from "react";
import type { AppStrings } from "../lib/i18n";

type MoreMenuProps = {
  t: AppStrings;
  open: boolean;
  onClose: () => void;
  onOpenFile: () => void;
  onOpenFolder: () => void;
  onPreferences: () => void;
  onExportHtml: () => void;
};

export function MoreMenu({ t, open, onClose, onOpenFile, onOpenFolder, onPreferences, onExportHtml }: MoreMenuProps) {
  if (!open) return null;

  const run = (action: () => void) => (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    action();
  };

  return (
    <div className="more-menu" role="menu">
      <button type="button" className="more-close" aria-label={t.common.close} onClick={run(onClose)}>
        <X size={14} />
      </button>
      <button type="button" onClick={run(onOpenFile)}>
        <FileCode2 size={15} /> {t.common.openFile}
      </button>
      <button type="button" onClick={run(onOpenFolder)}>
        <FolderOpen size={15} /> {t.common.openFolder}
      </button>
      <button type="button" onClick={run(onExportHtml)}>
        <FileCode2 size={15} /> {t.common.exportHtml}
      </button>
      <button type="button" onClick={run(onPreferences)}>
        <Settings size={15} /> {t.common.preferences}
      </button>
    </div>
  );
}
