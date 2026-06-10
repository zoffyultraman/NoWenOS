import { useEffect, useState, useCallback } from "react";
import { Command } from "cmdk";
import { motion, AnimatePresence } from "framer-motion";
import { useDesktopStore } from "@/stores/desktop";
import { appRegistry } from "@/desktop/appRegistry";
import { useTranslation } from "@/hooks/useTranslation";
import { Search } from "lucide-react";

export function AppLauncher() {
  const [open, setOpen] = useState(false);
  const t = useTranslation();
  const openApp = useDesktopStore((s) => s.openApp);

  // Cmd+K or Ctrl+K to open
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const handleSelect = useCallback(
    (appId: string) => {
      const app = appRegistry.find((a) => a.id === appId);
      if (!app) return;
      openApp(app.id, t(app.titleKey), app.id, {
        width: app.defaultWidth,
        height: app.defaultHeight,
        minWidth: app.minWidth,
        minHeight: app.minHeight,
      });
      setOpen(false);
    },
    [openApp, t]
  );

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10000] bg-black/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          {/* Command palette */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -20 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="fixed left-1/2 top-[20%] z-[10001] w-[520px] -translate-x-1/2"
          >
            <Command className="overflow-hidden rounded-2xl border border-border bg-card shadow-2xl shadow-black/30">
              <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Command.Input
                  autoFocus
                  placeholder={t("common.search") + " apps..."}
                  className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                />
                <kbd className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">ESC</kbd>
              </div>
              <Command.List className="max-h-[320px] overflow-y-auto p-2">
                <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
                  No results found.
                </Command.Empty>
                <Command.Group heading="Applications" className="px-2 pb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  {appRegistry.map((app) => {
                    const Icon = app.icon;
                    return (
                      <Command.Item
                        key={app.id}
                        value={t(app.titleKey)}
                        onSelect={() => handleSelect(app.id)}
                        className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-foreground aria-selected:bg-primary/10 aria-selected:text-primary transition-colors"
                      >
                        <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-${app.color}-500/15`}>
                          <Icon className={`h-4 w-4 text-${app.color}-400`} />
                        </div>
                        <span className="font-medium">{t(app.titleKey)}</span>
                      </Command.Item>
                    );
                  })}
                </Command.Group>
              </Command.List>
              <div className="flex items-center justify-between border-t border-border px-4 py-2">
                <span className="text-[10px] text-muted-foreground">Navigate with ↑↓ · Select with ↵</span>
                <div className="flex items-center gap-1">
                  <kbd className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">⌘</kbd>
                  <kbd className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">K</kbd>
                </div>
              </div>
            </Command>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}