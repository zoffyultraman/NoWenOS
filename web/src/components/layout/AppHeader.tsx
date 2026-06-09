import { useSessionStore } from "@/stores/session";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchAlertEvents } from "@/features/alerts/api";
import { Button } from "@/components/ui/button";
import { LogOut, User, Menu, Bell, Moon, Sun } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { useThemeStore } from "@/stores/theme";

interface AppHeaderProps {
  onMenuClick?: () => void;
}

export function AppHeader({ onMenuClick }: AppHeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const username = useSessionStore((state) => state.username);
  const clearSession = useSessionStore((state) => state.clearSession);
  const t = useTranslation();
  const { resolved, toggleTheme } = useThemeStore();

  const eventsQuery = useQuery({
    queryKey: ["alert-events-badge"],
    queryFn: () => fetchAlertEvents(10),
    refetchInterval: 15000,
    enabled: !!username,
  });

  const unseen = eventsQuery.data?.data?.unseen ?? 0;

  function handleLogout() {
    clearSession();
    navigate("/login", { replace: true });
  }

  return (
    <header className="flex h-14 items-center justify-between border-b bg-background px-4 lg:px-6">
      <div className="flex items-center gap-3">
        {onMenuClick && (
          <Button variant="ghost" size="sm" onClick={onMenuClick} className="lg:hidden h-9 w-9 p-0">
            <Menu className="h-5 w-5" />
          </Button>
        )}
        <p className="text-sm text-muted-foreground">{t("header.console")}</p>
      </div>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" onClick={toggleTheme} className="h-9 w-9 p-0" title={resolved === "dark" ? "Light mode" : "Dark mode"}>
          {resolved === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/alerts")}
          className={`relative h-9 w-9 p-0 ${location.pathname === "/alerts" ? "text-primary" : ""}`}
        >
          <Bell className="h-5 w-5" />
          {unseen > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
              {unseen > 9 ? "9+" : unseen}
            </span>
          )}
        </Button>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <User className="h-4 w-4" />
          <span className="hidden sm:inline">{username ?? "User"}</span>
        </div>
        <Button variant="outline" size="sm" onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          <span className="hidden sm:inline">{t("header.logout")}</span>
        </Button>
      </div>
    </header>
  );
}
