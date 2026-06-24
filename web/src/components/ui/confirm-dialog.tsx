import { Modal } from "./modal";
import { Button } from "./button";
import { useTranslation } from "@/hooks/useTranslation";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  variant?: "danger" | "default";
  loading?: boolean;
}

export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel, variant = "danger", loading }: ConfirmDialogProps) {
  const t = useTranslation();
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <p className="text-sm text-muted-foreground mb-6">{message}</p>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
        <Button variant={variant === "danger" ? "destructive" : "default"} onClick={onConfirm} disabled={loading}>
          {confirmLabel || t("common.confirm")}
        </Button>
      </div>
    </Modal>
  );
}
