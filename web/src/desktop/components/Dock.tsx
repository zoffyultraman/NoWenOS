import { motion } from "framer-motion";
import { useDesktopStore } from "@/stores/desktop";
import { dockApps, getApp } from "@/desktop/appRegistry";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";
import { Settings } from "lucide-react";

const colorMap: Record<string, string> = {
  cyan: "bg-cyan-500/15 text-cyan-400 shadow-cyan-500/20",
  purple: "bg-purple-500/15 text-purple-400 shadow-purple-500/20",
  green: "bg-green-500/15 text-green-400 shadow-green-500/20",
  orange: "bg-orange-500/15 text-orange-400 shadow-orange-500/20",
};

const activeColorMap: Record<string, string> = {
  cyan: "bg-cyan-500/25 text-cyan-300 shadow-lg shadow-cyan-500/30",
  purple: "bg-purple-500/25 text-purple-300 shadow-lg shadow-purple-500/30",
  green: "bg-green-500/25 text-green-300 shadow-lg shadow-green-500/30",
  orange: "bg-orange-500/25 text-orange-300 shadow-lg shadow-orange-500/30",
};

export function Dock() {
  const t = useTranslation();
  const { windows, openApp } = useDesktopStore();

  function handleOpenApp(appId: string) {
    const app = getApp(appId);
    if (!app) return;
    const title = t(app.titleKey);
    openApp(appId, title, app.id, {
      width: app.defaultWidth,
      height: app.defaultHeight,
      minWidth: app.minWidth,
      minHeight: app.minHeight,
    });
  }

  function isOpen(appId: string) {
    return windows.some((w) => w.appId === appId);
  }

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.2, type: "spring", stiffness: 300, damping: 25 }}
      className="fixed bottom-3 left-1/2 z-[9998] -translate-x-1/2"
    >
      <div className="flex items-center gap-1.5 rounded-2xl border border-border bg-background/80 px-2.5 py-1.5 shadow-2xl shadow-black/20 backdrop-blur-xl">
        {dockApps.map((app) => {
          const active = isOpen(app.id);
          const Icon = app.icon;
          return (
            <motion.button
              key={app.id}
              whileHover={{ scale: 1.1, y: -4 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleOpenApp(app.id)}
              className={cn(
                "group relative flex h-11 w-11 items-center justify-center rounded-xl transition-all duration-200",
                active ? activeColorMap[app.color] ?? activeColorMap.cyan : colorMap[app.color] ?? colorMap.cyan,
                "hover:shadow-lg"
              )}
              title={t(app.titleKey)}
            >
              <Icon className="h-5 w-5" />
              {active && (
                <div className="absolute -bottom-1 h-1 w-1 rounded-full bg-foreground shadow-sm" />
              )}
            </motion.button>
          );
        })}

        {/* Divider */}
        <div className="mx-1 h-8 w-px bg-border" />

        {/* Settings shortcut */}
        <motion.button
          whileHover={{ scale: 1.1, y: -4 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => handleOpenApp("settings")}
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-xl transition-all",
            isOpen("settings") ? activeColorMap.purple : colorMap.purple,
            "hover:shadow-lg"
          )}
          title={t("nav.settings")}
        >
          <Settings className="h-5 w-5" />
        </motion.button>
      </div>
    </motion.div>
  );
}