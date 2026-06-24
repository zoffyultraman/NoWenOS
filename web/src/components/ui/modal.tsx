import { useEffect, useRef, useCallback } from "react";
import { X } from "lucide-react";
import { Button } from "./button";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  children: React.ReactNode;
}

const sizeClasses = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-3xl",
  xl: "max-w-4xl",
};

export function Modal({ open, onClose, title, size = "md", children }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Escape key handler
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, handleKeyDown]);

  // Lock body scroll when open
  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  // Focus trap: focus first focusable element on open
  useEffect(() => {
    if (!open || !contentRef.current) return;
    const focusable = contentRef.current.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    focusable?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-label={typeof title === "string" ? title : undefined}
      onClick={onClose}
    >
      <div
        ref={contentRef}
        className={`mx-4 w-full ${sizeClasses[size]} max-h-[85vh] flex flex-col rounded-xl border bg-card text-card-foreground shadow`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-row items-center justify-between space-y-0 p-6 pb-2">
          <div className="font-semibold leading-none tracking-tight text-lg">
            {title}
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="p-6 pt-0 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
