import { useEffect, useRef } from "react";

type ShortcutMap = Record<string, (e?: KeyboardEvent) => void>;

export function useKeyboardShortcuts(shortcuts: ShortcutMap) {
  const ref = useRef(shortcuts);
  ref.current = shortcuts;

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === "INPUT" ||
                      target.tagName === "TEXTAREA" ||
                      target.tagName === "SELECT" ||
                      target.isContentEditable;

      if (e.key === "Escape" && ref.current["escape"]) {
        e.preventDefault();
        ref.current["escape"](e);
        return;
      }

      if (isInput) return;

      const isMod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      let combo = "";
      if (isMod) combo += "mod+";
      if (e.shiftKey) combo += "shift+";
      if (e.altKey) combo += "alt+";
      combo += key;

      if (ref.current[combo]) {
        e.preventDefault();
        ref.current[combo](e);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
}
