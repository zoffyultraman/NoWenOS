import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FolderPlus, ArrowLeft, Upload } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { BreadcrumbNav } from "./BreadcrumbNav";

interface FilePageHeaderProps {
  currentPath: string;
  resultPath: string | undefined;
  entryCount: number | undefined;
  hasParent: boolean;
  showMkdir: boolean;
  setShowMkdir: (v: boolean) => void;
  newDirName: string;
  setNewDirName: (v: string) => void;
  onNavigate: (path: string) => void;
  onGoUp: () => void;
  onMkdir: () => void;
  onUploadClick: () => void;
  uploadPending: boolean;
  mkdirPending: boolean;
  fileInputRef: (el: HTMLInputElement | null) => void;
  handleUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function FilePageHeader({
  currentPath, resultPath, entryCount, hasParent,
  showMkdir, setShowMkdir, newDirName, setNewDirName,
  onNavigate, onGoUp, onMkdir, onUploadClick,
  uploadPending, mkdirPending, fileInputRef, handleUpload,
}: FilePageHeaderProps) {
  const t = useTranslation();

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{t("files.title")}</h1>
          {entryCount !== undefined && (
            <span className="text-xs text-muted-foreground bg-muted/50 rounded-full px-2.5 py-0.5 font-medium">
              {entryCount} {entryCount === 1 ? t("files.item") : t("files.items")}
            </span>
          )}
          <BreadcrumbNav path={resultPath ?? currentPath} onNavigate={onNavigate} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={onGoUp} disabled={!hasParent} className="rounded-xl border-border bg-muted/30 hover:bg-muted/50">
            <ArrowLeft className="mr-1 h-3 w-3" /> {t("files.up")}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowMkdir(!showMkdir)} className="rounded-xl border-border bg-muted/30 hover:bg-muted/50">
            <FolderPlus className="mr-1 h-3 w-3" /> {t("files.newFolder")}
          </Button>
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleUpload} />
          <Button variant="default" size="sm" onClick={onUploadClick} disabled={uploadPending} className="rounded-xl">
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
              onKeyDown={(e) => e.key === "Enter" && onMkdir()}
            />
            <Button size="sm" onClick={onMkdir} disabled={mkdirPending}>{t("files.create")}</Button>
          </CardContent>
        </Card>
      )}
    </>
  );
}
