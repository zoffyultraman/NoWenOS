import { useFilesPage } from "@/features/files/hooks/useFilesPage";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useTranslation } from "@/hooks/useTranslation";
import { FilePreview } from "@/components/FilePreview";
import PermissionsDialog from "@/features/files/PermissionsDialog";
import MoveDialog from "@/features/files/MoveDialog";
import {
  Folder, File, Upload, Download, Trash2, FolderPlus,
  ArrowLeft, Pencil, Eye, Search, Archive, Package,
  CheckSquare, Square, Shield, FolderInput, MoreVertical,
} from "lucide-react";

function BreadcrumbNav({ path, onNavigate }: { path: string; onNavigate: (p: string) => void }) {
  const parts = path.split("/").filter(Boolean);
  const segments: { label: string; path: string }[] = [];
  for (let i = 0; i < parts.length; i++) {
    segments.push({ label: parts[i], path: parts.slice(0, i + 1).join("/") });
  }
  return (
    <div className="flex items-center gap-1 text-sm overflow-x-auto">
      <button onClick={() => onNavigate(".")} className="text-muted-foreground hover:text-foreground shrink-0">~</button>
      {segments.map((seg, i) => (
        <span key={seg.path} className="flex items-center gap-1 shrink-0">
          <span className="text-muted-foreground">/</span>
          {i === segments.length - 1 ? (
            <span className="font-medium text-foreground">{seg.label}</span>
          ) : (
            <button onClick={() => onNavigate(seg.path)} className="text-muted-foreground hover:text-foreground">{seg.label}</button>
          )}
        </span>
      ))}
    </div>
  );
}

export default function FilesPage() {
  const t = useTranslation();
  const {
    currentPath, showMkdir, setShowMkdir,
    newDirName, setNewDirName,
    renamingPath, setRenamingPath,
    newName, setNewName,
    searchQuery, setSearchQuery,
    searchResults, setSearchResults,
    selectedPaths, setSelectedPaths,
    isDragging,
    previewFile, setPreviewFile,
    permissionsFile, setPermissionsFile,
    movingFile, setMovingFile,
    deleteConfirm, setDeleteConfirm,
    batchDeleteConfirm, setBatchDeleteConfirm,
    fileInputEl, setFileInputEl,
    openMenu, setOpenMenu,
    result,
    filesQuery, uploadMutation, mkdirMutation,
    renameMutation, trashMutation,
    handleDragOver, handleDragLeave, handleDrop,
    handleSearch, toggleSelect, toggleSelectAll,
    handleBatchDelete, confirmBatchDelete, handleBatchCompress,
    handleNavigate, handleGoUp, handleUpload, handleDownload,
    handleDelete, confirmDelete, handleMkdir, formatSize,
  } = useFilesPage();

  useKeyboardShortcuts({
    "mod+n": () => setShowMkdir(true),
    "mod+u": () => fileInputEl?.click(),
    "mod+a": () => toggleSelectAll(),
    "delete": () => { if (selectedPaths.size > 0) handleBatchDelete(); },
    "backspace": () => { if (selectedPaths.size > 0) handleBatchDelete(); },
    "escape": () => {
      setSelectedPaths(new Set());
      setSearchResults(null);
      setSearchQuery("");
    },
  });

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{t("files.title")}</h1>
          {result && (
            <span className="text-xs text-muted-foreground bg-muted/50 rounded-full px-2.5 py-0.5 font-medium">
              {result.entries.length} {result.entries.length === 1 ? t("files.item") : t("files.items")}
            </span>
          )}
          <BreadcrumbNav path={result?.path ?? currentPath} onNavigate={handleNavigate} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleGoUp} disabled={!result?.parent} className="rounded-xl border-border bg-muted/30 hover:bg-muted/50">
            <ArrowLeft className="mr-1 h-3 w-3" /> {t("files.up")}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowMkdir(!showMkdir)} className="rounded-xl border-border bg-muted/30 hover:bg-muted/50">
            <FolderPlus className="mr-1 h-3 w-3" /> {t("files.newFolder")}
          </Button>
          <input ref={setFileInputEl} type="file" className="hidden" onChange={handleUpload} />
          <Button variant="default" size="sm" onClick={() => fileInputEl?.click()} disabled={uploadMutation.isPending} className="rounded-xl">
            <Upload className="mr-1 h-3 w-3" /> {t("files.upload")}
          </Button>
        </div>
      </div>

      {showMkdir && (
        <Card className="border-border bg-card">
          <CardContent className="flex items-center gap-2 py-3">
            <input
              type="text" value={newDirName}
              onChange={(e) => setNewDirName(e.target.value)}
              placeholder={t("files.newFolderName")}
              className="flex h-9 flex-1 rounded-md border border-border bg-muted/50 px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              onKeyDown={(e) => e.key === "Enter" && handleMkdir()}
            />
            <Button size="sm" onClick={handleMkdir} disabled={mkdirMutation.isPending}>{t("files.create")}</Button>
          </CardContent>
        </Card>
      )}

      {filesQuery.isLoading && <p className="text-sm text-muted-foreground">{t("files.loading")}</p>}
      {filesQuery.isError && (
        <Card className="border-destructive">
          <CardContent className="pt-6"><p className="text-sm text-destructive">{t("files.failed")}</p></CardContent>
        </Card>
      )}
      {result && result.entries.length === 0 && (
        <Card>
          <CardContent className="pt-6"><p className="text-sm text-muted-foreground">{t("files.empty")}</p></CardContent>
        </Card>
      )}

      {result && result.entries.length > 0 && (
        <Card className="border-border relative" onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
          <div className="flex items-center gap-2 px-4 pt-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text" value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); handleSearch(e.target.value); }}
                placeholder={t("files.searchPlaceholder")}
                className="w-full rounded-lg border border-border bg-muted/50 pl-9 pr-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            {selectedPaths.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{selectedPaths.size} {t("files.selected")}</span>
                <Button variant="outline" size="sm" onClick={handleBatchCompress} className="h-8 text-xs">
                  <Archive className="mr-1 h-3 w-3" />{t("files.compress")}
                </Button>
                <Button variant="destructive" size="sm" onClick={handleBatchDelete} className="h-8 text-xs">
                  <Trash2 className="mr-1 h-3 w-3" />{t("files.batchDelete")}
                </Button>
              </div>
            )}
          </div>

          {searchResults && (
            <Card className="border-border">
              <CardContent className="p-3">
                <p className="text-xs font-medium text-muted-foreground mb-2">{t("files.searchResults")} ({searchResults.length})</p>
                {searchResults.length === 0 && <p className="text-xs text-muted-foreground">{t("files.noResults")}</p>}
                {searchResults.map((f: any) => (
                  <button
                    key={f.path}
                    onClick={() => {
                      if (f.isDir) { handleNavigate(f.path); setSearchResults(null); setSearchQuery(""); }
                      else { setPreviewFile({ path: f.path, name: f.name }); }
                    }}
                    className="flex items-center gap-2 rounded px-2 py-1 hover:bg-muted/50 text-sm w-full text-left"
                  >
                    {f.isDir ? <Folder className="h-3.5 w-3.5 text-cyan-400" /> : <File className="h-3.5 w-3.5 text-muted-foreground" />}
                    <span className="truncate">{f.path}</span>
                  </button>
                ))}
                <button onClick={() => setSearchResults(null)} className="mt-2 text-xs text-muted-foreground hover:text-foreground">{t("files.closeResults")}</button>
              </CardContent>
            </Card>
          )}

          {isDragging && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg border-2 border-dashed border-primary bg-primary/5">
              <div className="flex flex-col items-center gap-2 text-primary">
                <Upload className="h-8 w-8" />
                <span className="text-sm font-medium">{t("files.dropUpload")}</span>
              </div>
            </div>
          )}
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              <div className="grid grid-cols-[36px_1fr_120px] md:grid-cols-[36px_1fr_120px_180px_120px] px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider bg-muted/30">
                <span className="flex items-center justify-center">
                  <button onClick={toggleSelectAll} className="h-4 w-4">
                    {selectedPaths.size > 0 && selectedPaths.size === (result?.entries.length ?? 0) ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4 text-muted-foreground" />}
                  </button>
                </span>
                <span>{t("files.name")}</span>
                <span className="text-right">{t("files.actions")}</span>
                <span className="hidden md:block text-right">{t("files.size")}</span>
                <span className="hidden md:block text-right">{t("files.modified")}</span>
              </div>
              {result.entries.map((entry) => (
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
                    <button type="button" className="flex items-center gap-2 text-left min-w-0" onClick={() => entry.isDir && handleNavigate(entry.path)}>
                      {entry.isDir ? <Folder className="h-4 w-4 flex-shrink-0 text-cyan-400" /> : <File className="h-4 w-4 flex-shrink-0 text-muted-foreground/60" />}
                      <span className={"truncate " + (entry.isDir ? "font-medium" : "")}>{entry.name}</span>
                    </button>
                  )}
                  <span className="text-right text-sm text-muted-foreground">{entry.isDir ? "—" : formatSize(entry.size)}</span>
                  <span className="text-right text-sm text-muted-foreground">{entry.modTime}</span>
                  <div className="text-right flex items-center justify-end gap-0.5">
                    {!entry.isDir && (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => setPreviewFile({ path: entry.path, name: entry.name })} className="h-8 w-8 p-0" title={t("files.preview")}><Eye className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDownload(entry.path)} className="h-8 w-8 p-0" title={t("files.download")}><Download className="h-4 w-4" /></Button>
                      </>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(entry.path, entry.name)} className="h-8 w-8 p-0 text-destructive hover:text-destructive" title={t("files.delete")}><Trash2 className="h-4 w-4" /></Button>
                    <div className="relative" onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="sm" onClick={() => setOpenMenu(openMenu === entry.path ? null : entry.path)} className="h-8 w-8 p-0"><MoreVertical className="h-4 w-4" /></Button>
                      {openMenu === entry.path && (
                        <div className="absolute right-0 top-8 z-20 w-40 rounded-lg border border-border bg-card shadow-lg py-1">
                          <button onClick={() => { setRenamingPath(entry.path); setNewName(entry.name); setOpenMenu(null); }} className="w-full px-3 py-1.5 text-left text-sm hover:bg-muted/50 flex items-center gap-2"><Pencil className="h-3.5 w-3.5" /> {t("files.rename")}</button>
                          <button onClick={() => { setMovingFile({ path: entry.path, name: entry.name }); setOpenMenu(null); }} className="w-full px-3 py-1.5 text-left text-sm hover:bg-muted/50 flex items-center gap-2"><FolderInput className="h-3.5 w-3.5" /> {t("files.moveTo")}</button>
                          {!entry.isDir && entry.name.endsWith(".tar.gz") && (
                            <button onClick={() => { /* extractMutation.mutate({ path: entry.path, dir: currentPath }); */ setOpenMenu(null); }} className="w-full px-3 py-1.5 text-left text-sm hover:bg-muted/50 flex items-center gap-2"><Package className="h-3.5 w-3.5" /> {t("files.extract")}</button>
                          )}
                          <button onClick={() => { setPermissionsFile({ path: entry.path, name: entry.name }); setOpenMenu(null); }} className="w-full px-3 py-1.5 text-left text-sm hover:bg-muted/50 flex items-center gap-2"><Shield className="h-3.5 w-3.5" /> {t("files.permissions")}</button>
                        </div>
                      )}
                    </div>
                  </div>
                  <span className="hidden md:block text-right text-sm text-muted-foreground">{entry.isDir ? "—" : formatSize(entry.size)}</span>
                  <span className="hidden md:block text-right text-sm text-muted-foreground">{entry.modTime}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {previewFile && <FilePreview path={previewFile.path} name={previewFile.name} onClose={() => setPreviewFile(null)} />}
      {permissionsFile && <PermissionsDialog path={permissionsFile.path} onClose={() => setPermissionsFile(null)} />}
      {movingFile && (
        <MoveDialog
          sourcePath={movingFile.path} sourceName={movingFile.name}
          onClose={() => setMovingFile(null)}
          onMoved={() => { /* queryClient.invalidateQueries */ setMovingFile(null); }}
        />
      )}
      <ConfirmDialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} onConfirm={confirmDelete} title={t("common.delete")} message={t("files.deleteConfirm").replace("{name}", deleteConfirm?.name ?? "")} loading={trashMutation.isPending} />
      <ConfirmDialog open={batchDeleteConfirm} onClose={() => setBatchDeleteConfirm(false)} onConfirm={confirmBatchDelete} title={t("files.batchDelete")} message={`${t("files.batchDelete")} (${selectedPaths.size})?`} loading={trashMutation.isPending} />
    </div>
  );
}
