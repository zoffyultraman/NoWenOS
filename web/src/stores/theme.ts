import { create } from "zustand";
import { persist } from "zustand/middleware";

type Theme = "light" | "dark" | "system";

interface ThemeState {
  theme: Theme;
  resolved: "light" | "dark";
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(resolved: "light" | "dark") {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (resolved === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: "system",
      resolved: getSystemTheme(),
      setTheme: (theme) => {
        const resolved = theme === "system" ? getSystemTheme() : theme;
        applyTheme(resolved);
        set({ theme, resolved });
      },
      toggleTheme: () => {
        const current = get().resolved;
        const next = current === "dark" ? "light" : "dark";
        applyTheme(next);
        set({ theme: next, resolved: next });
      },
    }),
    {
      name: "nowenos-theme",
      onRehydrateStorage: () => (state) => {
        if (state) {
          const resolved = state.theme === "system" ? getSystemTheme() : state.theme;
          applyTheme(resolved);
          state.resolved = resolved;
        }
      },
    }
  )
);

// Listen for system theme changes
if (typeof window !== "undefined") {
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
    const store = useThemeStore.getState();
    if (store.theme === "system") {
      const resolved = e.matches ? "dark" : "light";
      applyTheme(resolved);
      useThemeStore.setState({ resolved });
    }
  });
}
