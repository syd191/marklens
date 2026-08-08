import { memo } from "react";
import { ListTree, Search, X } from "lucide-react";
import type { AppStrings } from "../lib/i18n";
import type { EpubTocItem, OutlineItem, SidebarTab } from "../types";
import { FileTree } from "./FileTree";
import { OutlinePanel } from "./OutlinePanel";

type SidebarDrawerProps = {
  t: AppStrings;
  open: boolean;
  tab: SidebarTab;
  outline: OutlineItem[];
  fileRoot: DirectoryListing | null;
  currentPath: string | null;
  searchTerm: string;
  searchMatches: number[];
  epubToc?: EpubTocItem[] | null;
  epubCurrentSpine?: number;
  onSetTab: (tab: SidebarTab) => void;
  onClose: () => void;
  onJump: (item: OutlineItem) => void;
  onJumpToEpubToc?: (item: EpubTocItem) => void;
  onOpenFolder: () => void;
  onOpenFile: (filePath: string) => void;
  onRootUpdate: (listing: DirectoryListing) => void;
  onShowInFolder: (targetPath: string) => Promise<void>;
  onCreateMarkdown: (parentPath: string) => Promise<FileOperationResult>;
  onCreateFolder: (parentPath: string) => Promise<FileOperationResult>;
  onRenameEntry: (targetPath: string, nextName: string) => Promise<FileOperationResult>;
  onSearchTermChange: (value: string) => void;
  onJumpToSearchMatch: (line: number) => void;
  listDirectory: (dirPath: string) => Promise<DirectoryListing>;
};

export const SidebarDrawer = memo(function SidebarDrawer({
  t,
  open,
  tab,
  outline,
  fileRoot,
  currentPath,
  searchTerm,
  searchMatches,
  epubToc,
  epubCurrentSpine,
  onSetTab,
  onClose,
  onJump,
  onJumpToEpubToc,
  onOpenFolder,
  onOpenFile,
  onRootUpdate,
  onShowInFolder,
  onCreateMarkdown,
  onCreateFolder,
  onRenameEntry,
  onSearchTermChange,
  onJumpToSearchMatch,
  listDirectory
}: SidebarDrawerProps) {
  const isEpub = epubToc !== undefined && epubToc !== null;

  return (
    <aside className={`sidebar-drawer${open ? " is-open" : ""}`} aria-hidden={!open}>
      <div className="drawer-header">
        <div className="drawer-tabs" role="tablist" aria-label={t.drawer.aria}>
          <button type="button" className={tab === "outline" ? "is-active" : ""} onClick={() => onSetTab("outline")}>
            {t.drawer.outline}
          </button>
          {!isEpub && (
            <button type="button" className={tab === "files" ? "is-active" : ""} onClick={() => onSetTab("files")}>
              {t.drawer.files}
            </button>
          )}
          {!isEpub && (
            <button type="button" className={tab === "search" ? "is-active" : ""} onClick={() => onSetTab("search")}>
              {t.drawer.search}
            </button>
          )}
        </div>
        <button className="drawer-close" type="button" onClick={onClose} aria-label={t.drawer.closeSidebar}>
          <X size={15} />
        </button>
      </div>

      {tab === "outline" ? (
        isEpub && epubToc && onJumpToEpubToc ? (
          <div className="outline-panel">
            {epubToc.length > 0 ? (
              epubToc.map((item, index) => (
                <button
                  type="button"
                  key={`${item.id}-${index}`}
                  className={`outline-item${epubCurrentSpine === index ? " is-current" : ""}`}
                  style={{ paddingLeft: `${12 + item.level * 16}px` }}
                  onClick={() => onJumpToEpubToc(item)}
                >
                  {item.text}
                </button>
              ))
            ) : (
              <div className="empty-panel">{t.drawer.noMatches}</div>
            )}
          </div>
        ) : (
          <OutlinePanel t={t} outline={outline} onJump={onJump} />
        )
      ) : tab === "search" ? (
        <>
          <div className="drawer-search">
            <Search size={14} />
            <input
              value={searchTerm}
              placeholder={t.drawer.searchDocument}
              onChange={(event) => onSearchTermChange(event.target.value)}
            />
          </div>
          {searchTerm ? (
            <div className="search-results">
              {searchMatches.length ? (
                searchMatches.slice(0, 80).map((line) => (
                  <button type="button" key={line} onClick={() => onJumpToSearchMatch(line)}>
                    {t.drawer.line(line)}
                  </button>
                ))
              ) : (
                <div className="empty-panel">{t.drawer.noMatches}</div>
              )}
            </div>
          ) : (
            <div className="empty-panel">{t.drawer.searchDocument}</div>
          )}
        </>
      ) : (
        <FileTree
          t={t}
          root={fileRoot}
          selectedPath={currentPath}
          onOpenFolder={onOpenFolder}
          onOpenFile={onOpenFile}
          onRootUpdate={onRootUpdate}
          onShowInFolder={onShowInFolder}
          onCreateMarkdown={onCreateMarkdown}
          onCreateFolder={onCreateFolder}
          onRenameEntry={onRenameEntry}
          listDirectory={listDirectory}
        />
      )}

      <div className="drawer-footer">
        <ListTree size={14} />
        <span>{currentPath ? currentPath.split(/[\\/]/).pop() : t.drawer.noFile}</span>
      </div>
    </aside>
  );
});
