import { Rnd } from "react-rnd";
import { motion } from "framer-motion";
import { useDesktopStore, type DesktopWindow } from "@/stores/desktop";
import { getApp } from "@/desktop/appRegistry";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";
import { X, Minus, Square, Copy } from "lucide-react";

interface WindowFrameProps {
  win: DesktopWindow;
}

export function WindowFrame({ win }: WindowFrameProps) {
  const t = useTranslation();
  const { closeWindow, focusWindow, minimizeWindow, maximizeWindow, updateWindowPosition, updateWindowSize, activeWindowId } = useDesktopStore();
  const app = getApp(win.appId);
  const isActive = activeWindowId === win.id;
  const Component = app?.component;

  if (!app || !Component) return null;

  const TOP_BAR_HEIGHT = 32;

  return (
    <Rnd
      size={{ width: win.maximized ? "100%" : win.width, height: win.maximized ? `calc(100vh - ${TOP_BAR_HEIGHT}px - 64px)` : win.height }}
      position={win.maximized ? { x: 0, y: TOP_BAR_HEIGHT } : { x: win.x, y: win.y }}
      minWidth={win.minWidth}
      minHeight={win.minHeight}
      bounds="parent"
      dragHandleClassName="window-drag-handle"
      onMouseDown={() => focusWindow(win.id)}
      onDragStop={(_e, d) => updateWindowPosition(win.id, d.x, d.y)}
      onResize={(_e, _direction, ref, _delta, position) => {
        updateWindowSize(win.id, parseInt(ref.style.width), parseInt(ref.style.height));
        updateWindowPosition(win.id, position.x, position.y);
      }}
      disableDragging={win.maximized}
      enableResizing={!win.maximized}
      style={{ zIndex: win.zIndex, display: win.minimized ? "none" : "block" }}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className={cn(
          "flex h-full flex-col overflow-hidden rounded-xl border shadow-2xl shadow-black/30",
          isActive ? "border-border" : "border-border/50"
        )}
      >
        {/* Title bar */}
        <div
          className={cn(
            "window-drag-handle flex h-9 items-center justify-between px-3 select-none",
            isActive ? "bg-card" : "bg-card/70"
          )}
        >
          <div className="flex items-center gap-2">
            <div className={cn("flex h-5 w-5 items-center justify-center rounded-md", `bg-${app.color}-500/15`)}>
              <app.icon className={cn("h-3 w-3", `text-${app.color}-400`)} />
            </div>
            <span className={cn("text-xs font-medium", isActive ? "text-foreground" : "text-muted-foreground")}>
              {t(app.titleKey)}
            </span>
          </div>
          <div className="flex items-center gap-0.5">
            <button onClick={() => minimizeWindow(win.id)} className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
              <Minus className="h-3 w-3" />
            </button>
            <button onClick={() => maximizeWindow(win.id)} className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
              {win.maximized ? <Copy className="h-3 w-3" /> : <Square className="h-3 w-3" />}
            </button>
            <button onClick={() => closeWindow(win.id)} className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-danger/10 hover:text-danger transition-colors">
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-auto bg-background">
          <Component />
        </div>
      </motion.div>
    </Rnd>
  );
}