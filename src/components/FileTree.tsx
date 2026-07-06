import { ChevronDown, ChevronRight, FileText, Folder, FolderOpen } from "lucide-react";
import { useCallback, useState } from "react";
import type { AppStrings } from "../lib/i18n";

type FileTreeProps = {
  t: AppStrings;
  root: DirectoryListing | null;
  selectedPath: string | null;
  onOpenFolder: () => void;
  onOpenFile: (filePath: string) => void;
  listDirectory: (dirPath: string) => Promise<DirectoryListing>;
};

type DirectoryState = Record<string, DirectoryChild[] | undefined>;

export function FileTree({ t, root, selectedPath, onOpenFolder, onOpenFile, listDirectory }: FileTreeProps) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [childrenByPath, setChildrenByPath] = useState<DirectoryState>({});
  const [filter, setFilter] = useState("");

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

  const renderChildren = (items: DirectoryChild[], depth = 0) => {
    const visible = items.filter((item) => !filter || item.name.toLowerCase().includes(filter.toLowerCase()));
    return visible.map((item) => {
      const isDir = item.type === "directory";
      const isOpen = expanded.has(item.path);
      const nested = childrenByPath[item.path] ?? [];
      return (
        <div key={item.path}>
          <button
            type="button"
            className={`file-row${selectedPath === item.path ? " is-selected" : ""}`}
            style={{ paddingLeft: `${10 + depth * 14}px` }}
            onClick={() => (isDir ? toggleDirectory(item.path) : onOpenFile(item.path))}
            title={item.path}
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
            <span>{item.name}</span>
          </button>
          {isDir && isOpen && nested.length > 0 && <div>{renderChildren(nested, depth + 1)}</div>}
        </div>
      );
    });
  };

  return (
    <div className="files-panel">
      <input
        className="filter-input"
        value={filter}
        placeholder={t.files.filter}
        onChange={(event) => setFilter(event.target.value)}
      />
      <div className="tree-root">
        <div className="tree-root-name" title={root.path}>
          {root.name}
        </div>
        {renderChildren(root.children)}
      </div>
    </div>
  );
}
