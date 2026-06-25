import { useQuery } from "@tanstack/react-query";
import { fetchZFSInfo } from "@/features/storage/api";
import type { ZFSInfo, ZFSPool, ZFSVDev } from "@/features/storage/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "@/hooks/useTranslation";
import { Waves } from "lucide-react";

function InfoItem({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className={`text-sm font-medium ${color ?? "text-foreground"}`}>{value}</p>
    </div>
  );
}

function ZFSVDevRow({ dev, t }: { dev: ZFSVDev; t: (k: string) => string }) {
  const isOnline = dev.state === "ONLINE";
  return (
    <div className="rounded-lg bg-muted/50 px-3 py-2">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs text-foreground">{dev.name}</span>
        <span className={`text-xs font-medium ${isOnline ? "text-green-400" : "text-red-400"}`}>
          {dev.state}
        </span>
      </div>
      {(dev.read || dev.write || dev.cksum) && (
        <div className="mt-1 flex gap-4 text-[10px] text-muted-foreground">
          <span>{t("storage.zfs.read")}: {dev.read}</span>
          <span>{t("storage.zfs.write")}: {dev.write}</span>
          <span>{t("storage.zfs.cksum")}: {dev.cksum}</span>
        </div>
      )}
      {dev.children && dev.children.length > 0 && (
        <div className="mt-1.5 ml-3 space-y-1 border-l border-muted pl-3">
          {dev.children.map((child) => (
            <ZFSVDevRow key={child.name} dev={child} t={t} />
          ))}
        </div>
      )}
    </div>
  );
}

function ZFSPoolCard({ pool, t }: { pool: ZFSPool; t: (k: string) => string }) {
  const isHealthy = /online/i.test(pool.health);
  return (
    <Card className="border-border bg-card">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/10">
            <Waves className="h-4 w-4 text-sky-400" />
          </div>
          {pool.name}
        </CardTitle>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            isHealthy ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"
          }`}
        >
          {pool.health}
        </span>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <InfoItem label={t("storage.zfs.size")} value={pool.size || t("common.na")} />
          <InfoItem label={t("storage.zfs.allocated")} value={pool.allocated || t("common.na")} />
          <InfoItem label={t("storage.zfs.free")} value={pool.free || t("common.na")} />
          {pool.scan && <InfoItem label={t("storage.zfs.scan")} value={pool.scan} />}
        </div>
        {pool.devices.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">VDEVs</p>
            <div className="space-y-1.5">
              {pool.devices.map((dev) => (
                <ZFSVDevRow key={dev.name} dev={dev} t={t} />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ZFSTab() {
  const t = useTranslation();
  const zfsQuery = useQuery({ queryKey: ["zfs"], queryFn: fetchZFSInfo });
  const info: ZFSInfo = zfsQuery.data?.data ?? { pools: [], datasets: [] };
  const hasData = info.pools.length > 0 || info.datasets.length > 0;

  return (
    <div className="space-y-4">
      {zfsQuery.isLoading && (
        <Card className="border-border bg-card">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
          </CardContent>
        </Card>
      )}
      {zfsQuery.isError && (
        <Card className="border-danger/30 bg-danger/5">
          <CardContent className="pt-6">
            <p className="text-sm text-danger">Failed to load ZFS information.</p>
          </CardContent>
        </Card>
      )}
      {!hasData && !zfsQuery.isLoading && (
        <Card className="border-border bg-card">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">{t("storage.zfs.noZfs")}</p>
          </CardContent>
        </Card>
      )}

      {info.pools.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">{t("storage.zfs.pools")}</h2>
          <div className="space-y-4">
            {info.pools.map((pool) => (
              <ZFSPoolCard key={pool.name} pool={pool} t={t} />
            ))}
          </div>
        </div>
      )}

      {info.datasets.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">{t("storage.zfs.datasets")}</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {info.datasets.map((ds) => (
              <Card key={ds.name} className="border-border bg-card">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground truncate">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-500/10">
                      <Waves className="h-4 w-4 text-sky-400" />
                    </div>
                    <span className="truncate" title={ds.name}>{ds.name}</span>
                  </CardTitle>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground shrink-0">
                    {ds.type}
                  </span>
                </CardHeader>
                <CardContent className="space-y-1">
                  <div className="grid grid-cols-3 gap-2">
                    <InfoItem label={t("storage.zfs.used")} value={ds.used || t("common.na")} />
                    <InfoItem label={t("storage.zfs.avail")} value={ds.avail || t("common.na")} />
                    <InfoItem label={t("storage.zfs.refer")} value={ds.refer || t("common.na")} />
                  </div>
                  {ds.mountpoint && (
                    <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-1.5 mt-1">
                      <span className="text-xs text-muted-foreground">{t("storage.zfs.mountpoint")}:</span>
                      <span className="font-mono text-xs text-foreground truncate">{ds.mountpoint}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
