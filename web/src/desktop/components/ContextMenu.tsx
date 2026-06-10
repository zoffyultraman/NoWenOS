import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useDesktopStore } from "@/stores/desktop";
import { appRegistry } from "@/desktop/appRegistry";
import { useTranslation } from "@/hooks/useTranslation";
import { useNavigate } from "react-router-dom";
import { useSessionStore } from "@/stores/session";
import {
  LayoutDashboard, FolderOpen, HardDrive, Settings, LogOut, Info,
} from "lucide-react";

interface MenuItem {
  label: string;
  icon: React.ReactNode;
  action: () => void;
  dividerAfter?: boolean;
  danger?: boolean;
}

export function ContextMenu() {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const t = useTranslation();
  const openApp = useDesktopStore((s) => s.openApp);
  const navigate = useNavigate();
  const clearSession = useSessionStore((s) => s.clearSession);

  useEffect(() => {
    function handleContextMenu(e: MouseEvent) {
      // Only trigger on desktop background, not inside windows
      const target = e.target as HTMLElement;
      if (target.closest("[data-window]") || target.closest("button") || target.closest("input") || target.closest("a")) {
        return;
      }
      e.preventDefault();
      setPos({ x: e.clientX, y: e.clientY });
    }

    function handleClick() {
      setPos(null);
    }

    window.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("click", handleClick);
    return () => {
      window.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("click", handleClick);
    };
  }, []);

  function openSystemApp(id: string) {
    const app = appRegistry.find((a) => a.id === id);
    if (app) {
      openApp(app.id, t(app.titleKey), app.id, {
        width: app.defaultWidth,
        height: app.defaultHeight,
        minWidth: app.minWidth,
        minHeight: app.minHeight,
      });
    }
    setPos(null);
  }

  const items: MenuItem[] = [
    { label: t("nav.dashboard"), icon: <LayoutDashboard className="h-3.5 w-3.5" />, action: () => openSystemApp("dashboard") },
    { label: t("nav.files"), icon: <FolderOpen className="h-3.5 w-3.5" />, action: () => openSystemApp("files") },
    { label: t("nav.storage"), icon: <HardDrive className="h-3.5 w-3.5" />, action: () => openSystemApp("storage") },
    { label: t("nav.settings"), icon: <Settings className="h-3.5 w-3.5" />, action: () => openSystemApp("settings"), dividerAfter: true },
    { label: "About NoWenOS", icon: <Info className="h-3.5 w-3.5" />, action: () => openSystemApp("system") },
    { label: t("header.logout"), icon: <LogOut className="h-3.5 w-3.5" />, action: () => { clearSession(); navigate("/login", { replace: true }); }, danger: true },
  ];

  return (
    <AnimatePresence>
      {pos && (
        <motion.div
          ref={ref}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.1 }}
          className="fixed z-[10002] min-w-[180px] overflow-hidden rounded-xl border border-border bg-card p-1.5 shadow-2xl shadow-black/30 backdrop-blur-xl"
          style={{ left: pos.x, top: pos.y }}
        >
          {items.map((item, i) => (
            <div key={i}>
              <button
                onClick={item.action}
                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                  item.danger
                    ? "text-danger hover:bg-danger/10"
                    : "text-foreground hover:bg-primary/10 hover:text-primary"
                }`}
              >
                {item.icon}
                {item.label}
              </button>
              {item.dividerAfter && <div className="my-1 h-px bg-border" />}
            </div>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}