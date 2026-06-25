import { useQuery } from "@tanstack/react-query";
import { fetchLVMInfo } from "@/features/storage/api";
import type { LVMInfo } from "@/features/storage/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "@/hooks/useTranslation";
import { HardDrive, Database, Box } from "lucide-react";

function InfoItem({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className={`text-sm font-medium ${color ?? "text-foreground"}`}>{value}</p>
    </div>
  );
}

export function LVMTab() {
  const t = useTranslation();
  const lvmQuery = useQuery({ queryKey: ["lvm"], queryFn: fetchLVMInfo });
  const info: LVMInfo = lvmQuery.data?.data ?? { physicalVolumes: [], volumeGroups: [], logicalVolumes: [] };
  const hasData = info.physicalVolumes.length > 0 || info.volumeGroups.length > 0 || info.logicalVolumes.length > 0;

  return (
    <div className="space-y-4">
      {lvmQuery.isLoading && (
        <Card className="border-border bg-card">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
          </CardContent>
        </Card>
      )}
      {lvmQuery.isError && (
        <Card className="border-danger/30 bg-danger/5">
          <CardContent className="pt-6">
            <p className="text-sm text-danger">Failed to load LVM information.</p>
          </CardContent>
        </Card>
      )}
      {!hasData && !lvmQuery.isLoading && (
        <Card className="border-border bg-card">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">{t("storage.lvm.noLvm")}</p>
          </CardContent>
        </Card>
      )}

      {info.volumeGroups.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">{t("storage.lvm.vgs")}</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {info.volumeGroups.map((vg) => (
              <Card key={vg.name} className="border-border bg-card">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10">
                      <Box className="h-4 w-4 text-indigo-400" />
                    </div>
                    {vg.name}
                  </CardTitle>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">VG</span>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="text-xl font-bold text-foreground">{vg.size || t("common.na")}</div>
                  <div className="grid grid-cols-2 gap-2">
                    <InfoItem label={t("storage.lvm.free")} value={vg.free || t("common.na")} />
                    <InfoItem label={t("storage.lvm.pvCount")} value={String(vg.pvCount)} />
                    <InfoItem label={t("storage.lvm.lvCount")} value={String(vg.lvCount)} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {info.physicalVolumes.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">{t("storage.lvm.pvs")}</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {info.physicalVolumes.map((pv) => (
              <Card key={pv.name} className="border-border bg-card">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
                      <HardDrive className="h-4 w-4 text-emerald-400" />
                    </div>
                    {pv.name}
                  </CardTitle>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">PV</span>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2">
                    <InfoItem label={t("storage.lvm.size")} value={pv.size || t("common.na")} />
                    <InfoItem label={t("storage.lvm.free")} value={pv.free || t("common.na")} />
                    <InfoItem label={t("storage.lvm.vgName")} value={pv.vgName || "—"} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {info.logicalVolumes.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">{t("storage.lvm.lvs")}</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {info.logicalVolumes.map((lv) => (
              <Card key={lv.name} className="border-border bg-card">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10">
                      <Database className="h-4 w-4 text-violet-400" />
                    </div>
                    {lv.name}
                  </CardTitle>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">LV</span>
                </CardHeader>
                <CardContent className="space-y-1">
                  <div className="text-xl font-bold text-foreground">{lv.size || t("common.na")}</div>
                  <div className="grid grid-cols-2 gap-2">
                    <InfoItem label={t("storage.lvm.vgName")} value={lv.vgName || "—"} />
                    {lv.path && <InfoItem label={t("storage.lvm.path")} value={lv.path} />}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
