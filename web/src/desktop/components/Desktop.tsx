import { AnimatePresence } from "framer-motion";
import { useDesktopStore } from "@/stores/desktop";
import { TopBar } from "./TopBar";
import { Dock } from "./Dock";
import { WindowFrame } from "./WindowFrame";

export function Desktop() {
  const windows = useDesktopStore((s) => s.windows);

  return (
    <div className="fixed inset-0 overflow-hidden bg-background">
      {/* TopBar */}
      <TopBar />

      {/* Wallpaper / Desktop area */}
      <div className="absolute inset-0 top-8">
        {/* Subtle grid background */}
        <div className="absolute inset-0 bg-grid opacity-40" />
        {/* Gradient glow */}
        <div className="absolute left-1/4 top-1/4 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-500/5 blur-[150px]" />
        <div className="absolute right-1/4 bottom-1/4 h-[400px] w-[400px] translate-x-1/2 translate-y-1/2 rounded-full bg-purple-500/5 blur-[120px]" />

        {/* Windows container */}
        <div className="relative h-full w-full">
          <AnimatePresence>
            {windows.filter((w) => !w.minimized).map((win) => (
              <WindowFrame key={win.id} win={win} />
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Dock */}
      <Dock />
    </div>
  );
}