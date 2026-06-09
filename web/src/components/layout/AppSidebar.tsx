import { NavLink } from "react-router-dom";
import { HardDrive, LayoutDashboard, Container, FolderOpen, Users, ScrollText, Settings, Info, X, Share2, Bell, Globe, Moon, Sun } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";
import { useLocaleStore } from "@/stores/locale";
import { useThemeStore } from "@/stores/theme";

const navKeys = [
  { to: "/dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard },
  { to: "/system", labelKey: "nav.system", icon: Info },
  { to: "/storage", labelKey: "nav.storage", icon: HardDrive },
  { to: "/shares", labelKey: "nav.shares", icon: Share2 },
  { to: "/files", labelKey: "nav.files", icon: FolderOpen },
  { to: "/docker", labelKey: "nav.docker", icon: Container },
  { to: "/users", labelKey: "nav.users", icon: Users },
  { to: "/logs", labelKey: "nav.logs", icon: ScrollText },
  { to: "/alerts", labelKey: "nav.alerts", icon: Bell },
  { to: "/settings", labelKey: "nav.settings", icon: Settings },
];

interface AppSidebarProps {
  onClose?: () => void;
}

export function AppSidebar({ onClose }: AppSidebarProps) {
  const t = useTranslation();
  const { locale, toggleLocale } = useLocaleStore();
  const { resolved, toggleTheme } = useThemeStore();

  return (
    <aside className="flex w-64 flex-col bg-sidebar text-sidebar-foreground h-full">
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <HardDrive className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-none">NoWenOS</p>
            <p className="text-xs text-sidebar-foreground/60">NAS Panel</p>
          </div>
        </div>
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose} className="lg:hidden h-8 w-8 p-0">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <Separator className="bg-sidebar-border" />

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navKeys.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
              )
            }
          >
            <item.icon className="h-4 w-4" />
            {t(item.labelKey)}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-sidebar-border px-3 py-3 space-y-1">
        <Button variant="ghost" size="sm" onClick={toggleLocale} className="w-full justify-start gap-2 text-xs text-sidebar-foreground/60 hover:text-sidebar-foreground">
          <Globe className="h-3.5 w-3.5" />
          {locale === "zh" ? "English" : "中文"}
        </Button>
        <Button variant="ghost" size="sm" onClick={toggleTheme} className="w-full justify-start gap-2 text-xs text-sidebar-foreground/60 hover:text-sidebar-foreground">
          {resolved === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          {resolved === "dark" ? "Light Mode" : "Dark Mode"}
        </Button>
        <p className="px-3 text-xs text-sidebar-foreground/40">v0.1.0</p>
      </div>
    </aside>
  );
}
