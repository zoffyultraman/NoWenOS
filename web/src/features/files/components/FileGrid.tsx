import { CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Folder, File, Download, Trash2,
  Pencil, Eye, CheckSquare, Square,
  Shield, FolderInput, Package, MoreVertical,
} from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import type { FileEntry } from "@/features/files/api";

interface FileGridProps {
  entries: FileEntry[];
  selectedPaths: Set<string>;
  renamingPath: string | null;
  newName: string;
  openMenu: string | null;
  formatSize: (bytes: number) => string;
  toggleSelect: (path: string) => void;
  toggleSelectAll: () => void;
  setRenamingPath: (p: string | null) => void;
  setNewName: (n: string) => void;
  setOpenMenu: (m: string | null) => void;
  setPreviewFile: (f: { path: string; name: string } | null) => void;
  setPermissionsFile: (f: { path: string; name: string } | null) => void;
  setMovingFile: (f: { path: string; name: string } | null) => void;
  onNavigate: (path: string) => void;
  onDownload: (path: string) => void;
  onDelete: (path: string, name: string) => void;
  renameMutation: { mutate: (args: { path: string; newName: string }) => void };
}

export function FileGrid({
  entries, selectedPaths, renamingPath, newName, openMenu,
  formatSize,
  toggleSelect, toggleSelectAll,
  setRenamingPath, setNewName, setOpenMenu,
  setPreviewFile, setPermissionsFile, setMovingFile,
  onNavigate, onDownload, onDelete,
  renameMutation,
}: FileGridProps) {
  const t = useTranslation();

  return (
    <CardContent className="p-0">
      <div className="divide-y divide-border">
        <div className="grid grid-cols-[36px_1fr_120px] md:grid-cols-[36px_1fr_120px_180px_120px] px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider bg-muted/30">
          <span className="flex items-center justify-center">
            <button onClick={toggleSelectAll} className="h-4 w-4">
              {selectedPaths.size > 0 && selectedPaths.size === entries.length ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4 text-muted-foreground" />}
            </button>
          </span>
          <span>{t("files.name")}</span>
          <span className="text-right">{t("files.actions")}</span>
          <span className="hidden md:block text-right">{t("files.size")}</span>
          <span className="hidden md:block text-right">{t("files.modified")}</span>
        </div>
        {entries.map((entry) => (
          <div key={entry.path} className="grid grid-cols-[36px_1fr_120px] md:grid-cols-[36px_1fr_120px_180px_120px] items-center px-4 py-2.5 hover:bg-muted/30 transition-colors">
            <span className="flex items-center justify-center">
              <button onClick={() => toggleSelect(entry.path)}>
                {selectedPaths.has(entry.path) ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4 text-muted-foreground" />}
              </button>
            </span>
            {renamingPath === entry.path ? (
              <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") renameMutation.mutate({ path: entry.path, newName }); if (e.key === "Escape") { setRenamingPath(null); setNewName(""); } }}
                onBlur={() => { setRenamingPath(null); setNewName(""); }}
                className="h-7 w-48 rounded border border-primary bg-muted px-2 text-sm" />
            ) : (
              <button type="button" className="flex items-center gap-2 text-left min-w-0" onClick={() => entry.isDir && onNavigate(entry.path)}>
                {entry.isDir ? <Folder className="h-4 w-4 flex-shrink-0 text-cyan-400" /> : <File className="h-4 w-4 flex-shrink-0 text-muted-foreground/60" />}
                <span className={"truncate " + (entry.isDir ? "font-medium" : "")}>{entry.name}</span>
              </button>
            )}
            <span className="text-right text-sm text-muted-foreground">{entry.isDir ? "---" : formatSize(entry.size)}</span>
            <span className="text-right text-sm text-muted-foreground">{entry.modTime}</span>
            <div className="text-right flex items-center justify-end gap-0.5">
              {!entry.isDir && (
                <>
                  <Button variant="ghost" size="sm" onClick={() => setPreviewFile({ path: entry.path, name: entry.name })} className="h-8 w-8 p-0" title={t("files.preview")}><Eye className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => onDownload(entry.path)} className="h-8 w-8 p-0" title={t("files.download")}><Download className="h-4 w-4" /></Button>
                </>
              )}
              <Button variant="ghost" size="sm" onClick={() => onDelete(entry.path, entry.name)} className="h-8 w-8 p-0 text-destructive hover:text-destructive" title={t("files.delete")}><Trash2 className="h-4 w-4" /></Button>
              <div className="relative" onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="sm" onClick={() => setOpenMenu(openMenu === entry.path ? null : entry.path)} className="h-8 w-8 p-0"><MoreVertical className="h-4 w-4" /></Button>
                {openMenu === entry.path && (
                  <div className="absolute right-0 top-8 z-20 w-40 rounded-lg border border-border bg-card shadow-lg py-1">
                    <button onClick={() => { setRenamingPath(entry.path); setNewName(entry.name); setOpenMenu(null); }} className="w-full px-3 py-1.5 text-left text-sm hover:bg-muted/50 flex items-center gap-2"><Pencil className="h-3.5 w-3.5" /> {t("files.rename")}</button>
                    <button onClick={() => { setMovingFile({ path: entry.path, name: entry.name }); setOpenMenu(null); }} className="w-full px-3 py-1.5 text-left text-sm hover:bg-muted/50 flex items-center gap-2"><FolderInput className="h-3.5 w-3.5" /> {t("files.moveTo")}</button>
                    {!entry.isDir && entry.name.endsWith(".tar.gz") && (
                      <button onClick={() => { setOpenMenu(null); }} className="w-full px-3 py-1.5 text-left text-sm hover:bg-muted/50 flex items-center gap-2"><Package className="h-3.5 w-3.5" /> {t("files.extract")}</button>
                    )}
                    <button onClick={() => { setPermissionsFile({ path: entry.path, name: entry.name }); setOpenMenu(null); }} className="w-full px-3 py-1.5 text-left text-sm hover:bg-muted/50 flex items-center gap-2"><Shield className="h-3.5 w-3.5" /> {t("files.permissions")}</button>
                  </div>
                )}
              </div>
            </div>
            <span className="hidden md:block text-right text-sm text-muted-foreground">{entry.isDir ? "---" : formatSize(entry.size)}</span>
            <span className="hidden md:block text-right text-sm text-muted-foreground">{entry.modTime}</span>
          </div>
        ))}
      </div>
    </CardContent>
  );
}
