import { useQuery } from "@tanstack/react-query";
import { fetchRAIDStatus } from "@/features/storage/api";
import type { RAIDArray } from "@/features/storage/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "@/hooks/useTranslation";
import { Layers } from "lucide-react";

function InfoItem({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className={`text-sm font-medium ${color ?? "text-foreground"}`}>{value}</p>
    </div>
  );
}

function RAIDArrayCard({ array, t }: { array: RAIDArray; t: (k: string) => string }) {
  const isHealthy = /clean|active|online/i.test(array.state);
  return (
    <Card className="border-border bg-card">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10">
            <Layers className="h-4 w-4 text-amber-400" />
          </div>
          /dev/{array.name}
        </CardTitle>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            isHealthy ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"
          }`}
        >
          {array.state || t("common.na")}
        </span>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <InfoItem label={t("storage.raid.level")} value={array.level || t("common.na")} />
          <InfoItem label={t("storage.raid.size")} value={array.size || t("common.na")} />
          <InfoItem label={t("storage.raid.active")} value={String(array.active)} />
          <InfoItem label={t("storage.raid.failed")} value={String(array.failed)} color={array.failed > 0 ? "text-red-400" : undefined} />
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <InfoItem label={t("storage.raid.working")} value={String(array.working)} />
          <InfoItem label={t("storage.raid.spare")} value={String(array.spare)} />
          {array.rebuildPct && (
            <InfoItem label={t("storage.raid.rebuild")} value={array.rebuildPct} color="text-amber-400" />
          )}
        </div>
        {array.devices.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">{t("storage.raid.devices")}</p>
            <div className="flex flex-wrap gap-1.5">
              {array.devices.map((dev) => (
                <span key={dev} className="rounded bg-muted px-2 py-0.5 font-mono text-xs text-foreground">
                  {dev}
                </span>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function RAIDTab() {
  const t = useTranslation();
  const raidQuery = useQuery({ queryKey: ["raid"], queryFn: fetchRAIDStatus });
  const arrays = raidQuery.data?.data ?? [];

  return (
    <div className="space-y-4">
      {raidQuery.isLoading && (
        <Card className="border-border bg-card">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
          </CardContent>
        </Card>
      )}
      {raidQuery.isError && (
        <Card className="border-danger/30 bg-danger/5">
          <CardContent className="pt-6">
            <p className="text-sm text-danger">Failed to load RAID status.</p>
          </CardContent>
        </Card>
      )}
      {arrays.length === 0 && !raidQuery.isLoading && (
        <Card className="border-border bg-card">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">{t("storage.raid.noArrays")}</p>
          </CardContent>
        </Card>
      )}
      {arrays.map((arr) => (
        <RAIDArrayCard key={arr.name} array={arr} t={t} />
      ))}
    </div>
  );
}
