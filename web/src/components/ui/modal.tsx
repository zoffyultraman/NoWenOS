import { type ReactNode } from "react";
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
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex h-full items-center justify-center p-4">
        <div className={cn("w-full rounded-xl border border-border bg-card shadow-2xl", sizeMap[size], className)}>
          {title && (
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h2 className="text-lg font-semibold">{title}</h2>
              <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0">
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
