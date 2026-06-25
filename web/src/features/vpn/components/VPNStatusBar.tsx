import { Card, CardContent } from "@/components/ui/card";
import { useTranslation } from "@/hooks/useTranslation";
import type { VPNStatus } from "@/features/vpn/api";
import { Wifi, WifiOff, Clock, ArrowDownUp, Globe } from "lucide-react";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

interface VPNStatusBarProps {
  status: VPNStatus | undefined;
}

export function VPNStatusBar({ status }: VPNStatusBarProps) {
  const t = useTranslation();

  if (!status) return null;

  return (
    <Card>
      <CardContent className="flex items-center gap-4 py-3">
        <div
          className={
            "flex h-10 w-10 items-center justify-center rounded-xl " +
            (status.connected
              ? "bg-green-500/10 text-green-400 shadow-sm shadow-green-500/10"
              : "bg-muted text-muted-foreground")
          }
        >
          {status.connected ? <Wifi className="h-5 w-5" /> : <WifiOff className="h-5 w-5" />}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              {status.connected ? t("vpn.connectedTo").replace("{name}", status.configName || "") : t("vpn.noConnection")}
            </span>
            {status.connected && (
              <span className="rounded-full border border-green-500/20 bg-green-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-green-400">
                {status.type}
              </span>
            )}
          </div>
          {status.connected && (
            <div className="flex items-center gap-4 text-xs text-muted-foreground mt-0.5">
              {status.connectedAt && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {t("vpn.connectedAt")}: {new Date(status.connectedAt).toLocaleString()}
                </span>
              )}
              <span className="flex items-center gap-1">
                <ArrowDownUp className="h-3 w-3" />
                {t("vpn.trafficRx")}: {formatBytes(status.bytesRx)} / {t("vpn.trafficTx")}: {formatBytes(status.bytesTx)}
              </span>
              {status.publicIP && (
                <span className="flex items-center gap-1">
                  <Globe className="h-3 w-3" />
                  {t("vpn.publicIP")}: {status.publicIP}
                </span>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
