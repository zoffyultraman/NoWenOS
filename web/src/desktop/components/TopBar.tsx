import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchSystemInfo } from "@/features/system/api";
import { fetchAlertEvents } from "@/features/alerts/api";
import { useSessionStore } from "@/stores/session";
import { useDesktopStore } from "@/stores/desktop";
import { useTranslation } from "@/hooks/useTranslation";
import { useLocaleStore } from "@/stores/locale";
import { useThemeStore } from "@/stores/theme";
import { Button } from "@/components/ui/button";
import {
  HardDrive, Search, Bell, User, LogOut, Globe, Sun, Moon,
} from "lucide-react";

export function TopBar() {
  const navigate = useNavigate();
  const t = useTranslation();
  const username = useSessionStore((s) => s.username);
  const clearSession = useSessionStore((s) => s.clearSession);
  const { locale, toggleLocale } = useLocaleStore();
  const { resolved, toggleTheme } = useThemeStore();

  const systemQuery = useQuery({ queryKey: ["system-info"], queryFn: fetchSystemInfo });
  const eventsQuery = useQuery({
    queryKey: ["alert-events-badge"],
    queryFn: () => fetchAlertEvents(10),
    refetchInterval: 15000,
    enabled: !!username,
  });

  const unseen = eventsQuery.data?.data?.unseen ?? 0;
  const hostname = systemQuery.data?.data?.name ?? "NoWenOS";

  function handleLogout() {
    clearSession();
    navigate("/login", { replace: true });
  }

  function handleOpenAlerts() {
    useDesktopStore.getState().openApp("alerts", t("nav.alerts"), "Bell", {
      width: 1000, height: 680,
    });
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-[9999] flex h-8 items-center justify-between border-b border-border bg-background/90 px-3 backdrop-blur-md select-none"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      {/* Left: Logo + hostname */}
      <div className="flex items-center gap-2">
        <div className="flex h-5 w-5 items-center justify-center rounded-md bg-gradient-to-br from-cyan-500 to-cyan-600">
          <HardDrive className="h-3 w-3 text-white" />
        </div>
        <span className="text-xs font-bold tracking-wide text-foreground">NoWenOS</span>
        <span className="text-[10px] text-muted-foreground">—</span>
        <span className="text-[10px] text-muted-foreground">{hostname}</span>
      </div>

      {/* Center: Search hint */}
      <div className="flex items-center gap-1.5 rounded-md bg-muted/50 px-2.5 py-0.5 text-[10px] text-muted-foreground"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        <Search className="h-3 w-3" />
        <span>{t("common.search")}</span>
      </div>

      {/* Right: controls */}
      <div className="flex items-center gap-0.5"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        <Button variant="ghost" size="sm" onClick={toggleLocale} className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-foreground">
          <Globe className="h-3 w-3 mr-0.5" />
          {locale === "zh" ? "EN" : "中"}
        </Button>
        <Button variant="ghost" size="sm" onClick={toggleTheme} className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground">
          {resolved === "dark" ? <Sun className="h-3 w-3" /> : <Moon className="h-3 w-3" />}
        </Button>
        <div className="mx-1 h-3 w-px bg-border" />
        <Button variant="ghost" size="sm" onClick={handleOpenAlerts} className="relative h-6 w-6 p-0 text-muted-foreground hover:text-foreground">
          <Bell className="h-3 w-3" />
          {unseen > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-danger px-0.5 text-[8px] font-bold text-white">
              {unseen > 9 ? "9+" : unseen}
            </span>
          )}
        </Button>
        <div className="mx-1 flex items-center gap-1 rounded-md bg-muted px-2 py-0.5">
          <User className="h-3 w-3 text-primary" />
          <span className="text-[10px] font-medium">{username ?? "User"}</span>
        </div>
        <Button variant="ghost" size="sm" onClick={handleLogout} className="h-6 w-6 p-0 text-muted-foreground hover:text-danger">
          <LogOut className="h-3 w-3" />
        </Button>
      </div>
    </header>
  );
}