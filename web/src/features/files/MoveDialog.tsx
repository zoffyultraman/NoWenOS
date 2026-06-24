import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "@/hooks/useTranslation";
import { browseFiles, moveFile, type FileEntry } from "./api";
import { Button } from "@/components/ui/button";
import { useToast } from "@/stores/toast";
import { Folder, FolderInput, ArrowLeft } from "lucide-react";

interface MoveDialogProps {
  sourcePath: string;
  sourceName: string;
  onClose: () => void;
  onMoved: () => void;
}

export default function MoveDialog({ sourcePath, sourceName, onClose, onMoved }: MoveDialogProps) {
  const t = useTranslation();
  const toast = useToast();
  const [currentDir, setCurrentDir] = useState(".");

  const dirQuery = useQuery({
    queryKey: ["moveDialogDir", currentDir],
    queryFn: () => browseFiles(currentDir),
  });

  const entries: FileEntry[] = dirQuery.data?.data?.entries ?? [];
  const dirs = entries.filter((e) => e.isDir);
  const parent = dirQuery.data?.data?.parent;

  const moveMutation = useMutation({
    mutationFn: () => moveFile(sourcePath, currentDir),
    onSuccess: () => {
      toast.success(t("files.movedSuccess"));
      onMoved();
    },
    onError: () => toast.error(t("files.moveFailed")),
  });

  function handleNavigate(path: string) {
    setCurrentDir(path);
  }

  function handleGoUp() {
    if (parent) setCurrentDir(parent);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-card rounded-xl border border-border shadow-xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-lg font-semibold">{t("files.moveTo")}</h2>
            <p className="text-xs text-muted-foreground font-mono mt-0.5 truncate max-w-xs" title={sourcePath}>
              {sourceName}
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl leading-none">
            &times;
          </button>
        </div>

        {/* Current path */}
        <div className="px-6 pt-3 pb-1 shrink-0">
          <span className="text-xs text-muted-foreground font-mono bg-muted/50 rounded px-2 py-1">
            {dirQuery.data?.data?.path ?? currentDir}
          </span>
        </div>

        {/* Directory list */}
        <div className="flex-1 overflow-y-auto px-6 py-2 min-h-0">
          {dirQuery.isLoading && (
            <p className="text-sm text-muted-foreground py-4 text-center">{t("files.loading")}</p>
          )}
          {dirQuery.isError && (
            <p className="text-sm text-destructive py-4 text-center">{t("files.failed")}</p>
          )}
          {!dirQuery.isLoading && !dirQuery.isError && dirs.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">{t("files.empty")}</p>
          )}
          <div className="space-y-0.5">
            {parent && (
              <button
                onClick={handleGoUp}
                className="flex items-center gap-2 w-full rounded-lg px-3 py-2 text-sm hover:bg-muted/50 transition-colors text-muted-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
                {t("files.up")}
              </button>
            )}
            {dirs.map((dir) => (
              <button
                key={dir.path}
                onClick={() => handleNavigate(dir.path)}
                className="flex items-center gap-2 w-full rounded-lg px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
              >
                <Folder className="h-4 w-4 text-cyan-400 shrink-0" />
                <span className="truncate">{dir.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border shrink-0">
          <Button variant="outline" size="sm" onClick={onClose} className="rounded-xl">
            {t("permissions.close")}
          </Button>
          <Button
            size="sm"
            onClick={() => moveMutation.mutate()}
            disabled={moveMutation.isPending}
            className="rounded-xl"
          >
            <FolderInput className="mr-1 h-3 w-3" />
            {moveMutation.isPending ? t("permissions.applying") : t("files.moveToHere")}
          </Button>
        </div>
      </div>
    </div>
  );
}
