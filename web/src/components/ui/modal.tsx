import { type ReactNode, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { Button } from "./button";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
}

const sizeMap = { sm: "max-w-sm", md: "max-w-md", lg: "max-w-3xl", xl: "max-w-4xl" };

export function Modal({ open, onClose, title, children, className, size = "md" }: ModalProps) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  }, [onClose]);

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, handleKeyDown]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex h-full items-center justify-center p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? "modal-title" : undefined}
          className={cn("w-full rounded-xl border border-border bg-card shadow-2xl", sizeMap[size], className)}
        >
          {title && (
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h2 id="modal-title" className="text-lg font-semibold">{title}</h2>
              <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0" aria-label="Close">
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
          <div className="p-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
