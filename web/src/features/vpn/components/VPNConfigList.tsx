import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";
import type { VPNConfig } from "@/features/vpn/api";
import { Shield, Wifi, WifiOff, QrCode, Pencil, Trash2 } from "lucide-react";

interface VPNConfigListProps {
  configs: VPNConfig[];
  isLoading: boolean;
  isCurrentVPN: (id: number) => boolean;
  connectingId: number | null;
  statusConnected: boolean;
  onConnect: (id: number) => void;
  onDisconnect: (id: number) => void;
  onEdit: (cfg: VPNConfig) => void;
  onDelete: (id: number, name: string) => void;
  onQR: (cfg: VPNConfig) => void;
  isDisconnectPending: boolean;
}

export function VPNConfigList({
  configs,
  isLoading,
  isCurrentVPN,
  connectingId,
  statusConnected,
  onConnect,
  onDisconnect,
  onEdit,
  onDelete,
  onQR,
  isDisconnectPending,
}: VPNConfigListProps) {
  const t = useTranslation();

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">{t("vpn.loading")}</p>;
  }

  if (configs.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">{t("vpn.noConfigs")}</p>
          <p className="text-xs text-muted-foreground mt-1">{t("vpn.firstConfig")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {configs.map((cfg) => (
        <Card key={cfg.id} className="border-border bg-card transition-all duration-200 hover:border-border/80">
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-4">
              <div
                className={
                  "flex h-10 w-10 items-center justify-center rounded-xl transition-all " +
                  (isCurrentVPN(cfg.id)
                    ? "bg-green-500/10 text-green-400 shadow-sm shadow-green-500/10"
                    : "bg-muted text-muted-foreground")
                }
              >
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium truncate">{cfg.name}</p>
                  <span
                    className={
                      "rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider " +
                      (cfg.type === "wireguard"
                        ? "border border-blue-500/20 bg-blue-500/10 text-blue-400"
                        : "border border-orange-500/20 bg-orange-500/10 text-orange-400")
                    }
                  >
                    {cfg.type}
                  </span>
                  {isCurrentVPN(cfg.id) && (
                    <span className="rounded-full border border-green-500/20 bg-green-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-green-400">
                      {t("vpn.connected")}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("common.enabled")}: {cfg.enabled ? t("common.yes") : t("common.no")} &middot;{" "}
                  {new Date(cfg.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isCurrentVPN(cfg.id) ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onDisconnect(cfg.id)}
                  disabled={isDisconnectPending}
                  className="text-orange-500 border-orange-500/30 hover:bg-orange-500/10"
                >
                  <WifiOff className="mr-1.5 h-3.5 w-3.5" />
                  {t("vpn.disconnect")}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onConnect(cfg.id)}
                  disabled={connectingId === cfg.id || statusConnected}
                  className="text-green-500 border-green-500/30 hover:bg-green-500/10"
                >
                  <Wifi className="mr-1.5 h-3.5 w-3.5" />
                  {connectingId === cfg.id ? t("vpn.connecting") : t("vpn.connect")}
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => onQR(cfg)} className="h-8 w-8 p-0" title={t("vpn.qrCode")}>
                <QrCode className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onEdit(cfg)} className="h-8 w-8 p-0" title={t("common.edit")}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(cfg.id, cfg.name)}
                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                title={t("common.delete")}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
