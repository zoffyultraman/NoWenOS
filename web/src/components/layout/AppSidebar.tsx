import { NavLink } from "react-router-dom";
import { HardDrive, LayoutDashboard, Container, FolderOpen, Users, ScrollText, Settings, Info, X, Share2, Bell, Globe, Moon, Sun } from "lucide-react";
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
    <aside className="flex w-64 flex-col h-full border-r border-sidebar-border bg-sidebar-background">
      {/* Logo */}
      <div className="flex items-center justify-between px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-600 shadow-lg shadow-cyan-500/20">
            <HardDrive className="h-4.5 w-4.5 text-white" />
            <div className="absolute -inset-0.5 rounded-xl bg-gradient-to-br from-cyan-400 to-cyan-600 opacity-20 blur-sm" />
          </div>
          <div>
            <p className="text-sm font-bold tracking-wide text-sidebar-foreground">NoWenOS</p>
            <p className="text-[10px] font-medium uppercase tracking-widest text-sidebar-foreground/40">NAS Control</p>
          </div>
        </div>
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose} className="lg:hidden h-8 w-8 p-0 text-sidebar-foreground/60">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Divider */}
      <div className="mx-4 h-px bg-gradient-to-r from-transparent via-sidebar-border to-transparent" />

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 px-3 py-4">
        {navKeys.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-200",
                isActive
                  ? "bg-sidebar-accent text-cyan-400 font-medium shadow-sm"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )
            }
          >
            {({ isActive }) => (
              <>
                <div className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-lg transition-all duration-200",
                  isActive
                    ? "bg-cyan-500/15 text-cyan-400"
                    : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground/80"
                )}>
                  <item.icon className="h-4 w-4" />
                </div>
                <span>{t(item.labelKey)}</span>
                {isActive && (
                  <div className="ml-auto h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-sm shadow-cyan-400/50" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border px-3 py-3 space-y-1">
        <Button variant="ghost" size="sm" onClick={toggleLocale} className="w-full justify-start gap-2.5 rounded-xl text-xs text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/50">
          <Globe className="h-3.5 w-3.5" />
          {locale === "zh" ? "English" : "中文"}
        </Button>
        <Button variant="ghost" size="sm" onClick={toggleTheme} className="w-full justify-start gap-2.5 rounded-xl text-xs text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/50">
          {resolved === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          {resolved === "dark" ? "Light Mode" : "Dark Mode"}
        </Button>
        <p className="px-3 pt-1 text-[10px] font-medium tracking-wider text-sidebar-foreground/30">v0.1.0</p>
      </div>
    </aside>
  );
}
