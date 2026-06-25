import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchDisks, fetchSmartInfo, fetchMountpoints, mountDevice, unmountDevice, spinDownDevice } from "@/features/storage/api";
import type { DiskInfo, SmartInfo, Mountpoint } from "@/features/storage/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/stores/toast";
import { useTranslation } from "@/hooks/useTranslation";
import {
  HardDrive, Database, Server, ChevronDown, ChevronUp,
  Thermometer, Clock, Shield, FolderPlus, FolderMinus, Moon,
} from "lucide-react";

function InfoItem({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className={`text-sm font-medium ${color ?? "text-foreground"}`}>{value}</p>
    </div>
  );
}

function SmartSection({ device, t }: { device: string; t: (k: string) => string }) {
  const smartQuery = useQuery({
    queryKey: ["smart", device],
    queryFn: () => fetchSmartInfo(device),
    enabled: false,
  });

  return (
    <div className="mt-3 border-t border-border pt-3">
      <button
        onClick={() => smartQuery.refetch()}
        className="flex w-full items-center justify-between text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5" />
          {t("storage.smart.title")}
        </span>
        {smartQuery.isFetching ? (
          <span className="text-xs text-muted-foreground animate-pulse">{t("storage.smart.loading")}</span>
        ) : smartQuery.data ? (
          <ChevronUp className="h-3.5 w-3.5" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5" />
        )}
      </button>
      {smartQuery.data && <SmartDetails info={smartQuery.data.data} t={t} />}
      {smartQuery.isError && (
        <p className="mt-2 text-xs text-danger">{t("storage.smart.failed")}</p>
      )}
    </div>
  );
}

function SmartDetails({ info, t }: { info: SmartInfo; t: (k: string) => string }) {
  return (
    <div className="mt-2 space-y-1.5 text-xs">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">{t("storage.smart.health")}</span>
        <span className={info.smartStatus.passed ? "text-green-400" : "text-danger"}>
          {info.smartStatus.passed ? "PASSED" : "FAILED"}
        </span>
      </div>
      {info.temperature > 0 && (
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1 text-muted-foreground">
            <Thermometer className="h-3 w-3" />
            {t("storage.smart.temperature")}
          </span>
          <span className={info.temperature > 60 ? "text-warning" : "text-foreground"}>
            {info.temperature} C
          </span>
        </div>
      )}
      {info.powerOnHours > 0 && (
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1 text-muted-foreground">
            <Clock className="h-3 w-3" />
            {t("storage.smart.powerOn")}
          </span>
          <span className="text-foreground">{info.powerOnHours.toLocaleString()} h</span>
        </div>
      )}
      {info.reallocatedSectors > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">{t("storage.smart.reallocated")}</span>
          <span className="text-warning">{info.reallocatedSectors}</span>
        </div>
      )}
      {info.pendingSectors > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">{t("storage.smart.pending")}</span>
          <span className="text-warning">{info.pendingSectors}</span>
        </div>
      )}
    </div>
  );
}

function MountDialog({ disk, open, onClose, t }: { disk: DiskInfo; open: boolean; onClose: () => void; t: (k: string) => string }) {
  const [mountpoint, setMountpoint] = useState(`/mnt/nowenos/${disk.name}`);
  const toast = useToast();
  const queryClient = useQueryClient();

  const mountMutation = useMutation({
    mutationFn: () => mountDevice(disk.name, mountpoint),
    onSuccess: () => {
      toast.success(t("storage.mountSuccess"));
      queryClient.invalidateQueries({ queryKey: ["disks"] });
      queryClient.invalidateQueries({ queryKey: ["mountpoints"] });
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      title={t("storage.mountTitle")}
      description={`${t("storage.mountDesc")} /dev/${disk.name}`}
      confirmLabel={t("storage.mountBtn")}
      variant="default"
      loading={mountMutation.isPending}
      onConfirm={() => mountMutation.mutate()}
    >
      <div className="mb-4">
        <label className="mb-1 block text-xs text-muted-foreground">{t("storage.mountTarget")}</label>
        <Input
          value={mountpoint}
          onChange={(e) => setMountpoint(e.target.value)}
          placeholder="/mnt/nowenos/mydisk"
          className="font-mono text-sm"
        />
      </div>
    </ConfirmDialog>
  );
}

function UnmountConfirm({ disk, open, onClose, t }: { disk: DiskInfo; open: boolean; onClose: () => void; t: (k: string) => string }) {
  const toast = useToast();
  const queryClient = useQueryClient();

  const unmountMutation = useMutation({
    mutationFn: () => unmountDevice(disk.mountpoint),
    onSuccess: () => {
      toast.success(t("storage.unmountSuccess"));
      queryClient.invalidateQueries({ queryKey: ["disks"] });
      queryClient.invalidateQueries({ queryKey: ["mountpoints"] });
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      title={t("storage.unmountTitle")}
      message={`${t("storage.unmountDesc")} ${disk.mountpoint}?`}
      confirmLabel={t("storage.unmountBtn")}
      variant="danger"
      loading={unmountMutation.isPending}
      onConfirm={() => unmountMutation.mutate()}
    />
  );
}

function SpinDownConfirm({ disk, open, onClose, t }: { disk: DiskInfo; open: boolean; onClose: () => void; t: (k: string) => string }) {
  const toast = useToast();

  const spinDownMutation = useMutation({
    mutationFn: () => spinDownDevice(disk.name),
    onSuccess: () => {
      toast.success(t("storage.spinDownSuccess"));
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      title={t("storage.spinDownTitle")}
      message={`${t("storage.spinDownDesc")} /dev/${disk.name}?`}
      confirmLabel={t("storage.spinDownBtn")}
      variant="default"
      loading={spinDownMutation.isPending}
      onConfirm={() => spinDownMutation.mutate()}
    />
  );
}

function DiskCard({ disk, t }: { disk: DiskInfo; t: (k: string) => string }) {
  const isDisk = disk.type === "disk";
  const [showMount, setShowMount] = useState(false);
  const [showUnmount, setShowUnmount] = useState(false);
  const [showSpinDown, setShowSpinDown] = useState(false);

  return (
    <>
      <Card className="group border-border bg-card transition-all duration-200 hover:border-cyan-500/20 hover:shadow-lg hover:shadow-cyan-500/5">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${isDisk ? "bg-cyan-500/10" : "bg-purple-500/10"}`}>
              {isDisk ? (
                <HardDrive className="h-4 w-4 text-cyan-400" />
              ) : (
                <Database className="h-4 w-4 text-purple-400" />
              )}
            </div>
            {disk.name}
          </CardTitle>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {disk.type}
          </span>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="text-2xl font-bold text-foreground">{disk.size || t("common.na")}</div>
          <p className="text-xs text-muted-foreground">
            {disk.model || t("storage.unknownModel")}
          </p>
          {disk.mountpoint && (
            <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-1.5">
              <span className="text-xs text-muted-foreground">{t("storage.mount")}:</span>
              <span className="font-mono text-xs text-foreground">{disk.mountpoint}</span>
            </div>
          )}
          {disk.fstype && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{t("storage.fs")}:</span>
              <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">{disk.fstype}</span>
            </div>
          )}
          {disk.mountpoint && disk.usedPct > 0 && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">{disk.used ?? "—"}</span>
                <span className="text-muted-foreground">{disk.size}</span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${disk.usedPct > 90 ? "bg-danger" : disk.usedPct > 70 ? "bg-warning" : "bg-primary"}`}
                  style={{ width: `${Math.min(disk.usedPct, 100)}%` }}
                />
              </div>
              <p className="text-right text-[10px] text-muted-foreground">{disk.usedPct}% used</p>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            {!disk.mountpoint && isDisk && (
              <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => setShowMount(true)}>
                <FolderPlus className="mr-1 h-3 w-3" />
                {t("storage.mountBtn")}
              </Button>
            )}
            {disk.mountpoint && (
              <Button size="sm" variant="outline" className="flex-1 text-xs text-danger border-danger/30 hover:bg-danger/10" onClick={() => setShowUnmount(true)}>
                <FolderMinus className="mr-1 h-3 w-3" />
                {t("storage.unmountBtn")}
              </Button>
            )}
            {isDisk && (
              <Button size="sm" variant="outline" className="text-xs" onClick={() => setShowSpinDown(true)}>
                <Moon className="mr-1 h-3 w-3" />
                {t("storage.spinDownBtn")}
              </Button>
            )}
          </div>

          {isDisk && <SmartSection device={disk.name} t={t} />}
        </CardContent>
      </Card>

      {showMount && <MountDialog disk={disk} open={showMount} onClose={() => setShowMount(false)} t={t} />}
      {showUnmount && <UnmountConfirm disk={disk} open={showUnmount} onClose={() => setShowUnmount(false)} t={t} />}
      {showSpinDown && <SpinDownConfirm disk={disk} open={showSpinDown} onClose={() => setShowSpinDown(false)} t={t} />}
    </>
  );
}

function MountpointsTable({ mounts, isLoading, t }: { mounts: Mountpoint[]; isLoading: boolean; t: (k: string) => string }) {
  if (isLoading) return null;
  if (mounts.length === 0) return null;

  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">{t("storage.mountpoints")}</h2>
      <Card className="border-border bg-card">
        <CardContent className="pt-4">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">{t("storage.mp.source")}</th>
                  <th className="pb-2 pr-4 font-medium">{t("storage.mp.target")}</th>
                  <th className="pb-2 pr-4 font-medium">{t("storage.mp.fstype")}</th>
                  <th className="pb-2 pr-4 font-medium">{t("storage.mp.options")}</th>
                  <th className="pb-2 font-medium">{t("storage.mp.used")}</th>
                </tr>
              </thead>
              <tbody>
                {mounts.map((m, i) => (
                  <tr key={i} className="border-b border-border/50 last:border-0">
                    <td className="py-2 pr-4 font-mono text-foreground">{m.source}</td>
                    <td className="py-2 pr-4 font-mono text-foreground">{m.target}</td>
                    <td className="py-2 pr-4">
                      <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground">{m.fstype}</span>
                    </td>
                    <td className="max-w-[200px] truncate py-2 pr-4 text-muted-foreground" title={m.options}>
                      {m.options}
                    </td>
                    <td className="py-2">
                      {m.usedPct > 0 ? (
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                            <div
                              className={`h-full rounded-full ${m.usedPct > 90 ? "bg-danger" : m.usedPct > 70 ? "bg-warning" : "bg-primary"}`}
                              style={{ width: `${Math.min(m.usedPct, 100)}%` }}
                            />
                          </div>
                          <span className="text-muted-foreground">{m.usedPct}%</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function DisksTab() {
  const t = useTranslation();
  const disksQuery = useQuery({ queryKey: ["disks"], queryFn: fetchDisks });
  const disks = disksQuery.data?.data ?? [];
  const physicalDisks = disks.filter((d) => d.type === "disk");
  const partitions = disks.filter((d) => d.type === "part");

  const mountsQuery = useQuery({ queryKey: ["mountpoints"], queryFn: fetchMountpoints });
  const mounts = mountsQuery.data?.data ?? [];

  return (
    <>
      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-border bg-card">
          <CardContent className="flex items-center gap-4 pt-5 pb-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-500/10">
              <HardDrive className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{physicalDisks.length}</p>
              <p className="text-xs text-muted-foreground">Physical Disks</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="flex items-center gap-4 pt-5 pb-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-500/10">
              <Database className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{partitions.length}</p>
              <p className="text-xs text-muted-foreground">Partitions</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="flex items-center gap-4 pt-5 pb-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-500/10">
              <Server className="h-5 w-5 text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{disks.filter((d) => d.mountpoint).length}</p>
              <p className="text-xs text-muted-foreground">Mounted</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {disksQuery.isLoading && (
        <Card className="border-border bg-card">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">{t("storage.loading")}</p>
          </CardContent>
        </Card>
      )}
      {disksQuery.isError && (
        <Card className="border-danger/30 bg-danger/5">
          <CardContent className="pt-6">
            <p className="text-sm text-danger">{t("storage.failed")}</p>
          </CardContent>
        </Card>
      )}
      {disks.length === 0 && !disksQuery.isLoading && (
        <Card className="border-border bg-card">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">{t("storage.noDisks")}</p>
          </CardContent>
        </Card>
      )}

      {physicalDisks.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Physical Disks</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {physicalDisks.map((disk) => (
              <DiskCard key={disk.name} disk={disk} t={t} />
            ))}
          </div>
        </div>
      )}

      {partitions.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Partitions</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {partitions.map((disk) => (
              <DiskCard key={disk.name} disk={disk} t={t} />
            ))}
          </div>
        </div>
      )}

      <MountpointsTable mounts={mounts} isLoading={mountsQuery.isLoading} t={t} />
    </>
  );
}
