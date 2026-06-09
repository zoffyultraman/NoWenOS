import { useSessionStore } from "@/stores/session";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchAlertEvents } from "@/features/alerts/api";
import { Button } from "@/components/ui/button";
import { LogOut, User, Menu, Bell } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

interface AppHeaderProps {
  onMenuClick?: () => void;
}

export function AppHeader({ onMenuClick }: AppHeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const username = useSessionStore((state) => state.username);
  const clearSession = useSessionStore((state) => state.clearSession);
  const t = useTranslation();

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

  const pageTitle = getPageTitle(location.pathname, t);

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur-md lg:px-6">
      <div className="flex items-center gap-3">
        {onMenuClick && (
          <Button variant="ghost" size="sm" onClick={onMenuClick} className="lg:hidden h-9 w-9 p-0">
            <Menu className="h-5 w-5" />
          </Button>
        )}
        <div>
          <h2 className="text-sm font-semibold text-foreground">{pageTitle}</h2>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/alerts")}
          className={`relative h-9 w-9 p-0 ${location.pathname === "/alerts" ? "text-primary" : "text-muted-foreground"}`}
        >
          <Bell className="h-4.5 w-4.5" />
          {unseen > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white shadow-sm shadow-danger/30">
              {unseen > 9 ? "9+" : unseen}
            </span>
          )}
        </Button>
        <div className="mx-2 flex items-center gap-2 rounded-lg bg-muted px-3 py-1.5">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/15">
            <User className="h-3.5 w-3.5 text-primary" />
          </div>
          <span className="text-xs font-medium text-foreground">{username ?? "User"}</span>
        </div>
        <Button variant="ghost" size="sm" onClick={handleLogout} className="h-9 w-9 p-0 text-muted-foreground hover:text-danger" title={t("header.logout")}>
          <LogOut className="h-4.5 w-4.5" />
        </Button>
      </div>
    </header>
  );
}

function getPageTitle(pathname: string, t: (key: string) => string): string {
  const map: Record<string, string> = {
    "/dashboard": "nav.dashboard",
    "/system": "nav.system",
    "/storage": "nav.storage",
    "/shares": "nav.shares",
    "/files": "nav.files",
    "/docker": "nav.docker",
    "/users": "nav.users",
    "/logs": "nav.logs",
    "/alerts": "nav.alerts",
    "/settings": "nav.settings",
  };
  return t(map[pathname] ?? "header.console");
}
