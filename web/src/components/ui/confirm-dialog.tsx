import { Modal } from "./modal";
import { Button } from "./button";
import { useTranslation } from "@/hooks/useTranslation";

interface ConfirmDialogProps {
  open?: boolean;
  onClose?: () => void;
  onCancel?: () => void;
  onConfirm: () => void;
  title: string;
  message?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "default" | "destructive";
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  onCancel,
  onConfirm,
  title,
  message,
  description,
  confirmLabel,
  cancelLabel,
  variant = "danger",
  loading,
}: ConfirmDialogProps) {
  const t = useTranslation();
  const handleClose = onClose || onCancel || (() => {});
  const displayMessage = message || description || "";
  const variantStyle = variant === "danger" || variant === "destructive" ? "destructive" : "default";

  // If open prop is provided, use controlled mode with Modal
  if (open !== undefined) {
    return (
      <Modal open={open} onClose={handleClose} title={title} size="sm">
        <p className="text-sm text-muted-foreground mb-6">{displayMessage}</p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={handleClose}>
            {cancelLabel || t("common.cancel")}
          </Button>
          <Button variant={variantStyle} onClick={onConfirm} disabled={loading}>
            {confirmLabel || t("common.confirm")}
          </Button>
        </div>
      </Modal>
    );
  }

  // Conditional rendering mode (no open prop)
  return (
    <Modal open={true} onClose={handleClose} title={title} size="sm">
      <p className="text-sm text-muted-foreground mb-6">{displayMessage}</p>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={handleClose}>
          {cancelLabel || t("common.cancel")}
        </Button>
        <Button variant={variantStyle} onClick={onConfirm} disabled={loading}>
          {confirmLabel || t("common.confirm")}
        </Button>
      </div>
    </Modal>
  );
}
