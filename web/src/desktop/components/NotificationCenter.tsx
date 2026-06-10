import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { fetchAlertEvents } from "@/features/alerts/api";
import { useDesktopStore } from "@/stores/desktop";
import { useTranslation } from "@/hooks/useTranslation";
import { Bell, AlertCircle, AlertTriangle, Info, CheckCircle } from "lucide-react";

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const t = useTranslation();
  const openApp = useDesktopStore((s) => s.openApp);

  const eventsQuery = useQuery({
    queryKey: ["alert-events-center"],
    queryFn: () => fetchAlertEvents(50),
    refetchInterval: 15000,
  });

  const events = eventsQuery.data?.data?.events ?? [];
  const unseen = eventsQuery.data?.data?.unseen ?? 0;

  // Click outside to close
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [open]);

  function handleOpenAlerts() {
    openApp("alerts", t("nav.alerts"), "Bell", { width: 1000, height: 680 });
    setOpen(false);
  }

  function getLevelIcon(level: string) {
    switch (level) {
      case "critical": return <AlertCircle className="h-3.5 w-3.5 text-red-400" />;
      case "warning": return <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />;
      default: return <Info className="h-3.5 w-3.5 text-cyan-400" />;
    }
  }

  function getLevelBg(level: string) {
    switch (level) {
      case "critical": return "border-red-500/20 bg-red-500/5";
      case "warning": return "border-amber-500/20 bg-amber-500/5";
      default: return "border-border bg-card";
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:text-foreground transition-colors"
      >
        <Bell className="h-3 w-3" />
        {unseen > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-danger px-0.5 text-[8px] font-bold text-white">
            {unseen > 9 ? "9+" : unseen}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-[340px] overflow-hidden rounded-xl border border-border bg-card shadow-2xl shadow-black/30 backdrop-blur-xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
              <span className="text-xs font-semibold text-foreground">Notifications</span>
              <div className="flex items-center gap-1">
                {unseen > 0 && (
                  <span className="rounded-full bg-danger/10 px-2 py-0.5 text-[10px] font-bold text-danger">
                    {unseen} new
                  </span>
                )}
              </div>
            </div>

            {/* Events list */}
            <div className="max-h-[300px] overflow-y-auto">
              {events.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                  <CheckCircle className="h-8 w-8 text-green-400/40" />
                  <span className="text-xs">No notifications</span>
                </div>
              ) : (
                <div className="p-1.5 space-y-1">
                  {events.slice(0, 15).map((event) => (
                    <div
                      key={event.id}
                      className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 transition-colors ${getLevelBg(event.level)} ${
                        !event.seen ? "ring-1 ring-primary/20" : ""
                      }`}
                    >
                      <div className="mt-0.5 shrink-0">{getLevelIcon(event.level)}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{event.ruleName ?? "Alert"}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{event.message}</p>
                        <p className="text-[10px] text-muted-foreground/60 mt-1">{event.createdAt}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-border px-4 py-2">
              <button
                onClick={handleOpenAlerts}
                className="w-full text-center text-[11px] font-medium text-primary hover:text-primary/80 transition-colors"
              >
                View all alerts →
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}