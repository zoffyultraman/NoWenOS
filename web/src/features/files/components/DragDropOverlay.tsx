import { Upload } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

export function DragDropOverlay() {
  const t = useTranslation();
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg border-2 border-dashed border-primary bg-primary/5">
      <div className="flex flex-col items-center gap-2 text-primary">
        <Upload className="h-8 w-8" />
        <span className="text-sm font-medium">{t("files.dropUpload")}</span>
      </div>
    </div>
  );
}
