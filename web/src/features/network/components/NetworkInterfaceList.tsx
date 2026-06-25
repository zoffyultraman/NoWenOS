import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";
import { formatBytes, type NetworkInterface } from "@/features/network/api";
import { ArrowUp, ArrowDown, Settings, Wifi } from "lucide-react";

interface NetworkInterfaceListProps {
  interfaces: NetworkInterface[];
  isLoading: boolean;
  isError: boolean;
  onConfigure: (iface: NetworkInterface) => void;
  onBringUp: (name: string) => void;
  onBringDown: (name: string) => void;
  isUpPending: boolean;
  isDownPending: boolean;
}

export function NetworkInterfaceList({
  interfaces,
  isLoading,
  isError,
  onConfigure,
  onBringUp,
  onBringDown,
  isUpPending,
  isDownPending,
}: NetworkInterfaceListProps) {
  const t = useTranslation();

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">{t("network.loading")}</p>;
  }

  if (isError) {
    return (
      <Card className="border-danger/30 bg-danger/5">
        <CardContent className="pt-6">
          <p className="text-sm text-danger">{t("network.failed")}</p>
        </CardContent>
      </Card>
    );
  }

  if (interfaces.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">{t("network.noInterfaces")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {interfaces.map((iface) => (
        <Card key={iface.name} className="border-border bg-card transition-all duration-200 hover:border-border/80">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              {/* Left: Interface Info */}
              <div className="flex items-center gap-4">
                <div
                  className={
                    "flex h-10 w-10 items-center justify-center rounded-xl transition-all " +
                    (iface.status === "up"
                      ? "bg-green-500/10 text-green-400 shadow-sm shadow-green-500/10"
                      : "bg-muted text-muted-foreground")
                  }
                >
                  <Wifi className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{iface.name}</p>
                    <span
                      className={
                        "rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider " +
                        (iface.status === "up"
                          ? "border border-green-500/20 bg-green-500/10 text-green-400"
                          : "border border-border bg-muted text-muted-foreground")
                      }
                    >
                      {iface.status === "up" ? t("network.up") : t("network.down")}
                    </span>
                    {iface.isConfigured && iface.config && (
                      <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-cyan-400">
                        {iface.config.mode === "dhcp" ? t("network.dhcp") : t("network.static")}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t("network.mac")}: {iface.mac || t("common.na")}
                  </p>
                </div>
              </div>

              {/* Center: Address & Traffic */}
              <div className="hidden md:flex items-center gap-8">
                <div className="text-center min-w-[140px]">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">{t("network.ip")}</p>
                  <p className="text-sm font-mono font-medium">{iface.ipAddress || t("common.na")}</p>
                </div>
                <div className="text-center min-w-[100px]">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">{t("network.speed")}</p>
                  <p className="text-sm font-medium">{iface.speed}</p>
                </div>
                <div className="text-center min-w-[80px]">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">{t("network.mtu")}</p>
                  <p className="text-sm font-medium">{iface.mtu}</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                      <ArrowDown className="h-3 w-3 text-green-400" /> {t("network.rx")}
                    </p>
                    <p className="text-xs font-mono font-medium text-green-400">{formatBytes(iface.rxBytes)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                      <ArrowUp className="h-3 w-3 text-cyan-400" /> {t("network.tx")}
                    </p>
                    <p className="text-xs font-mono font-medium text-cyan-400">{formatBytes(iface.txBytes)}</p>
                  </div>
                </div>
              </div>

              {/* Right: Actions */}
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onConfigure(iface)}
                  className="h-8 w-8 p-0"
                  title={t("network.configure")}
                >
                  <Settings className="h-4 w-4" />
                </Button>
                {iface.status === "up" ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onBringDown(iface.name)}
                    disabled={isDownPending}
                    className="h-8 w-8 p-0 text-amber-500 hover:text-amber-600"
                    title={t("network.bringDown")}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onBringUp(iface.name)}
                    disabled={isUpPending}
                    className="h-8 w-8 p-0 text-green-500 hover:text-green-600"
                    title={t("network.bringUp")}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Mobile: extra details below */}
            <div className="mt-3 flex flex-wrap gap-4 md:hidden text-xs text-muted-foreground">
              <span>{t("network.ip")}: <span className="font-mono font-medium text-foreground">{iface.ipAddress || t("common.na")}</span></span>
              <span>{t("network.speed")}: <span className="font-medium text-foreground">{iface.speed}</span></span>
              <span>{t("network.mtu")}: <span className="font-medium text-foreground">{iface.mtu}</span></span>
              <span className="text-green-400">{t("network.rx")}: {formatBytes(iface.rxBytes)}</span>
              <span className="text-cyan-400">{t("network.tx")}: {formatBytes(iface.txBytes)}</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
