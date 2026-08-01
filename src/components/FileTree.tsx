import { ChevronDown, ChevronRight, FileText, Folder, FolderOpen } from "lucide-react";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import type { AppStrings } from "../lib/i18n";

type FileTreeProps = {
  t: AppStrings;
  root: DirectoryListing | null;
  selectedPath: string | null;
  onOpenFolder: () => void;
  onOpenFile: (filePath: string) => void;
  onRootUpdate: (listing: DirectoryListing) => void;
  onShowInFolder: (targetPath: string) => Promise<void>;
  onCreateMarkdown: (parentPath: string) => Promise<FileOperationResult>;
  onCreateFolder: (parentPath: string) => Promise<FileOperationResult>;
  onRenameEntry: (targetPath: string, nextName: string) => Promise<FileOperationResult>;
  listDirectory: (dirPath: string) => Promise<DirectoryListing>;
};

type DirectoryState = Record<string, DirectoryChild[] | undefined>;
type ContextTarget = DirectoryChild | { name: string; path: string; type: "root" };
type ContextMenuState = { x: number; y: number; target: ContextTarget } | null;

function parentPathOf(filePath: string) {
  const normalized = filePath.replace(/[\\/]+$/, "");
  const index = Math.max(normalized.lastIndexOf("\\"), normalized.lastIndexOf("/"));
  return index > 0 ? normalized.slice(0, index) : normalized;
}

function extensionOf(name: string) {
  const match = name.match(/(\.[^.\\/]+)$/);
  return match?.[1] ?? "";
}

function targetParentPath(target: ContextTarget) {
  if (target.type === "root" || target.type === "directory") return target.path;
  return parentPathOf(target.path);
}

export function FileTree({
  t,
  root,
  selectedPath,
  onOpenFolder,
  onOpenFile,
  onRootUpdate,
  onShowInFolder,
  onCreateMarkdown,
  onCreateFolder,
  onRenameEntry,
  listDirectory
}: FileTreeProps) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [childrenByPath, setChildrenByPath] = useState<DirectoryState>({});
  const [filter, setFilter] = useState("");
  // 用 deferred 延迟过滤计算，让输入框始终保持响应；快速输入时过滤结果稍后更新
  const deferredFilter = useDeferredValue(filter);
  const filterLower = useMemo(() => deferredFilter.toLowerCase(), [deferredFilter]);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renamingValue, setRenamingValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const cancelRenameRef = useRef(false);

  const refreshDirectory = useCallback(
    async (dirPath: string) => {
      const listing = await listDirectory(dirPath);
      if (root?.path === dirPath) {
        onRootUpdate(listing);
      } else {
        setChildrenByPath((current) => ({ ...current, [dirPath]: listing.children }));
      }
    },
    [listDirectory, onRootUpdate, root?.path]
  );

  const toggleDirectory = useCallback(
    async (dirPath: string) => {
      const nextExpanded = new Set(expanded);
      if (nextExpanded.has(dirPath)) {
        nextExpanded.delete(dirPath);
        setExpanded(nextExpanded);
        return;
      }

      nextExpanded.add(dirPath);
      setExpanded(nextExpanded);
      if (!childrenByPath[dirPath]) {
        const listing = await listDirectory(dirPath);
        setChildrenByPath((current) => ({ ...current, [dirPath]: listing.children }));
      }
    },
    [childrenByPath, expanded, listDirectory]
  );

  useEffect(() => {
    const close = () => setContextMenu(null);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setContextMenu(null);
        setRenamingPath(null);
      }
    };

    window.addEventListener("click", close);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  if (!root) {
    return (
      <div className="empty-panel">
        <p>{t.files.noFolder}</p>
        <button className="plain-button" type="button" onClick={onOpenFolder}>
          {t.files.openFolder}
        </button>
      </div>
    );
  }

  const rootTarget: ContextTarget = { name: root.name, path: root.path, type: "root" };

  const openContextMenu = (event: React.MouseEvent, target: ContextTarget) => {
    event.preventDefault();
    event.stopPropagation();
    setError("");
    setContextMenu({ x: event.clientX, y: event.clientY, target });
  };

  const createMarkdown = async (target: ContextTarget) => {
    setBusy(true);
    setError("");
    const parentPath = targetParentPath(target);
    const result = await onCreateMarkdown(parentPath);
    if (result.ok) {
      await refreshDirectory(result.parentPath);
      setRenamingPath(result.path);
      setRenamingValue(result.path.split(/[\\/]/).pop() ?? "");
    } else {
      setError(t.files.operationFailed);
    }
    setBusy(false);
  };

  const createFolder = async (target: ContextTarget) => {
    setBusy(true);
    setError("");
    const parentPath = targetParentPath(target);
    const result = await onCreateFolder(parentPath);
    if (result.ok) {
      setExpanded((current) => new Set(current).add(parentPath));
      await refreshDirectory(result.parentPath);
      setRenamingPath(result.path);
      setRenamingValue(result.path.split(/[\\/]/).pop() ?? "");
    } else {
      setError(t.files.operationFailed);
    }
    setBusy(false);
  };

  const startRename = (target: ContextTarget) => {
    if (target.type === "root") return;
    setContextMenu(null);
    setError("");
    cancelRenameRef.current = false;
    setRenamingPath(target.path);
    setRenamingValue(target.name);
  };

  const commitRename = async (target: DirectoryChild) => {
    if (cancelRenameRef.current) {
      cancelRenameRef.current = false;
      return;
    }
    const originalName = target.name;
    const trimmed = renamingValue.trim();
    if (!renamingPath || !trimmed || trimmed === originalName) {
      setRenamingPath(null);
      return;
    }

    const nextName = target.type === "file" && !extensionOf(trimmed) ? `${trimmed}${extensionOf(originalName)}` : trimmed;
    setBusy(true);
    setError("");
    const result = await onRenameEntry(target.path, nextName);
    if (result.ok) {
      await refreshDirectory(result.parentPath);
      setRenamingPath(null);
      setRenamingValue("");
    } else {
      setError(t.files.operationFailed);
    }
    setBusy(false);
  };

  const showInFolder = async (target: ContextTarget) => {
    setBusy(true);
    setError("");
    await onShowInFolder(target.path).catch(() => setError(t.files.operationFailed));
    setBusy(false);
  };

  const onPanelContextMenu = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest(".file-row") || target.closest(".filter-input")) return;
    openContextMenu(event, rootTarget);
  };

  const renderChildren = (items: DirectoryChild[], depth = 0) => {
    const visible = items.filter((item) => !filterLower || item.name.toLowerCase().includes(filterLower));
    return visible.map((item) => {
      const isDir = item.type === "directory";
      const isOpen = expanded.has(item.path);
      const nested = childrenByPath[item.path] ?? [];
      const isRenaming = renamingPath === item.path;
      return (
        <div key={item.path}>
          <button
            type="button"
            className={`file-row${selectedPath === item.path ? " is-selected" : ""}`}
            style={{ paddingLeft: `${10 + depth * 14}px` }}
            onClick={() => {
              if (isRenaming) return;
              isDir ? toggleDirectory(item.path) : onOpenFile(item.path);
            }}
            onContextMenu={(event) => openContextMenu(event, item)}
          >
            {isDir ? (
              isOpen ? (
                <ChevronDown size={14} />
              ) : (
                <ChevronRight size={14} />
              )
            ) : (
              <span className="file-spacer" />
            )}
            {isDir ? (isOpen ? <FolderOpen size={15} /> : <Folder size={15} />) : <FileText size={15} />}
            {isRenaming ? (
              <input
                className="rename-input"
                autoFocus
                value={renamingValue}
                placeholder={t.files.renamePlaceholder}
                onChange={(event) => setRenamingValue(event.target.value)}
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    event.currentTarget.blur();
                  }
                  if (event.key === "Escape") {
                    cancelRenameRef.current = true;
                    setRenamingPath(null);
                  }
                }}
                onBlur={() => void commitRename(item)}
              />
            ) : (
              <span>{item.name}</span>
            )}
          </button>
          {isDir && isOpen && nested.length > 0 && <div>{renderChildren(nested, depth + 1)}</div>}
        </div>
      );
    });
  };

  return (
    <div className="files-panel" onContextMenu={onPanelContextMenu}>
      <input
        className="filter-input"
        value={filter}
        placeholder={t.files.filter}
        onChange={(event) => setFilter(event.target.value)}
      />
      <div className="tree-root">
        <div className="tree-root-name" onContextMenu={(event) => openContextMenu(event, rootTarget)}>
          {root.name}
        </div>
        {renderChildren(root.children)}
      </div>

      {contextMenu && (
        <div className="file-context-menu" style={{ left: contextMenu.x, top: contextMenu.y }} role="menu">
          <button type="button" disabled={busy} onClick={() => void showInFolder(contextMenu.target)}>
            {t.files.showInFolder}
          </button>
          <button type="button" disabled={busy} onClick={() => void createMarkdown(contextMenu.target)}>
            {t.files.newMarkdown}
          </button>
          <button type="button" disabled={busy} onClick={() => void createFolder(contextMenu.target)}>
            {t.files.newFolder}
          </button>
          {contextMenu.target.type !== "root" && (
            <button type="button" disabled={busy} onClick={() => startRename(contextMenu.target)}>
              {t.files.rename}
            </button>
          )}
        </div>
      )}

      {error && <div className="file-error">{error}</div>}
    </div>
  );
}
