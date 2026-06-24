import { useEffect, useRef } from "react";

interface ShortcutMap {
  [key: string]: (e?: KeyboardEvent) => void;
}

export function useKeyboardShortcuts(shortcuts: ShortcutMap) {
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const isMod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();

      // Build shortcut string like "mod+k", "mod+n", etc.
      let combo = "";
      if (isMod) combo += "mod+";
      if (e.shiftKey) combo += "shift+";
      if (e.altKey) combo += "alt+";
      combo += key;

      if (shortcutsRef.current[combo]) {
        e.preventDefault();
        shortcutsRef.current[combo](e);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []); // stable reference via ref
}
