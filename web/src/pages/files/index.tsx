import { useFilesPage } from "@/features/files/hooks/useFilesPage";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useTranslation } from "@/hooks/useTranslation";
import { FilePreview } from "@/components/FilePreview";
import PermissionsDialog from "@/features/files/PermissionsDialog";
import MoveDialog from "@/features/files/MoveDialog";
import { FilePageHeader } from "@/features/files/components/FilePageHeader";
import { FileGrid } from "@/features/files/components/FileGrid";
import { FileActionBar } from "@/features/files/components/FileActionBar";
import { DragDropOverlay } from "@/features/files/components/DragDropOverlay";

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
      <FilePageHeader
        currentPath={currentPath} resultPath={result?.path}
        entryCount={result?.entries.length} hasParent={!!result?.parent}
        showMkdir={showMkdir} setShowMkdir={setShowMkdir}
        newDirName={newDirName} setNewDirName={setNewDirName}
        onNavigate={handleNavigate} onGoUp={handleGoUp}
        onMkdir={handleMkdir} onUploadClick={() => fileInputEl?.click()}
        uploadPending={uploadMutation.isPending} mkdirPending={mkdirMutation.isPending}
        fileInputRef={setFileInputEl} handleUpload={handleUpload}
      />

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
          <FileActionBar
            searchQuery={searchQuery} setSearchQuery={setSearchQuery}
            onSearch={handleSearch} searchResults={searchResults} setSearchResults={setSearchResults}
            onNavigate={handleNavigate} onPreview={setPreviewFile}
            selectedPaths={selectedPaths} onBatchCompress={handleBatchCompress} onBatchDelete={handleBatchDelete}
          />
          {isDragging && <DragDropOverlay />}
          <FileGrid
            entries={result.entries} selectedPaths={selectedPaths}
            renamingPath={renamingPath} newName={newName} openMenu={openMenu}
            formatSize={formatSize}
            toggleSelect={toggleSelect} toggleSelectAll={toggleSelectAll}
            setRenamingPath={setRenamingPath} setNewName={setNewName} setOpenMenu={setOpenMenu}
            setPreviewFile={setPreviewFile} setPermissionsFile={setPermissionsFile} setMovingFile={setMovingFile}
            onNavigate={handleNavigate} onDownload={handleDownload} onDelete={handleDelete}
            renameMutation={renameMutation}
          />
        </Card>
      )}

      {previewFile && <FilePreview path={previewFile.path} name={previewFile.name} onClose={() => setPreviewFile(null)} />}
      {permissionsFile && <PermissionsDialog path={permissionsFile.path} onClose={() => setPermissionsFile(null)} />}
      {movingFile && (
        <MoveDialog
          sourcePath={movingFile.path} sourceName={movingFile.name}
          onClose={() => setMovingFile(null)}
          onMoved={() => { setMovingFile(null); }}
        />
      )}
      <ConfirmDialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} onConfirm={confirmDelete} title={t("common.delete")} message={t("files.deleteConfirm").replace("{name}", deleteConfirm?.name ?? "")} loading={trashMutation.isPending} />
      <ConfirmDialog open={batchDeleteConfirm} onClose={() => setBatchDeleteConfirm(false)} onConfirm={confirmBatchDelete} title={t("files.batchDelete")} message={`${t("files.batchDelete")} (${selectedPaths.size})?`} loading={trashMutation.isPending} />
    </div>
  );
}
