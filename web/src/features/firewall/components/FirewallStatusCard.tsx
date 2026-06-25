import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent } from "@/components/ui/card";
import type { FirewallStatus } from "@/features/firewall/api";

interface FirewallStatusCardProps {
  status: FirewallStatus;
}

export function FirewallStatusCard({ status }: FirewallStatusCardProps) {
  const t = useTranslation();

  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-3">
        <div className={"h-2.5 w-2.5 rounded-full " + (status.running ? "bg-green-400 shadow-sm shadow-green-400/50" : status.installed ? "bg-amber-400 shadow-sm shadow-amber-400/50" : "bg-muted-foreground shadow-sm shadow-muted-foreground/50")} />
        <span className="text-sm font-medium">{t("firewall.backend")}: {status.backend === "none" ? t("firewall.noBackend") : status.backend}</span>
        <span className="text-xs text-muted-foreground">
          {status.installed ? (status.running ? t("firewall.running") : t("firewall.installedNotRunning")) : t("firewall.notInstalled")}
        </span>
        {status.version && <span className="text-xs text-muted-foreground">{status.version.trim()}</span>}
        <span className="ml-auto text-xs text-muted-foreground">
          {t("firewall.activeRules")}: {status.ruleCount}
        </span>
      </CardContent>
    </Card>
  );
}
