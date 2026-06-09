import { useToastStore, type ToastVariant } from "@/stores/toast";
import { X } from "lucide-react";

const variantStyles: Record<ToastVariant, string> = {
  default: "bg-background border-border text-foreground",
  success: "bg-green-600 border-green-700 text-white",
  error: "bg-destructive border-red-700 text-white",
  warning: "bg-amber-500 border-amber-600 text-white",
};

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-sm shadow-lg animate-in slide-in-from-right-full fade-in duration-300 ${variantStyles[toast.variant]}`}
        >
          <span className="flex-1">{toast.message}</span>
          <button
            onClick={() => removeToast(toast.id)}
            className="shrink-0 opacity-70 hover:opacity-100 transition-opacity"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
