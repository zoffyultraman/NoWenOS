import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchDisks,
  fetchSmartInfo,
  fetchMountpoints,
  mountDevice,
  unmountDevice,
  fetchRAIDStatus,
  fetchLVMInfo,
  fetchZFSInfo,
  spinDownDevice,
} from "@/features/storage/api";
import type {
  DiskInfo,
  SmartInfo,
  Mountpoint,
  RAIDArray,
  LVMInfo,
  ZFSInfo,
  ZFSPool,
  ZFSVDev,
} from "@/features/storage/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/stores/toast";
import {
  HardDrive,
  Database,
  Server,
  ChevronDown,
  ChevronUp,
  Thermometer,
  Clock,
  Shield,
  FolderPlus,
  FolderMinus,
  Layers,
  Box,
  Waves,
  Moon,
} from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

type Tab = "disks" | "raid" | "lvm" | "zfs";

export default function StoragePage() {
  const t = useTranslation();
  const [activeTab, setActiveTab] = useState<Tab>("disks");

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "disks", label: t("storage.tabDisks"), icon: <HardDrive className="h-4 w-4" /> },
    { key: "raid", label: t("storage.tabRaid"), icon: <Layers className="h-4 w-4" /> },
    { key: "lvm", label: t("storage.tabLvm"), icon: <Box className="h-4 w-4" /> },
    { key: "zfs", label: t("storage.tabZfs"), icon: <Waves className="h-4 w-4" /> },
  ];

  return (
    <div className="space-y-4 p-4">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("storage.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("storage.subtitle")}</p>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 rounded-lg bg-muted p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "disks" && <DisksTab t={t} />}
      {activeTab === "raid" && <RAIDTab t={t} />}
      {activeTab === "lvm" && <LVMTab t={t} />}
      {activeTab === "zfs" && <ZFSTab t={t} />}
    </div>
  );
}

/* ───────────────────── Disks Tab ───────────────────── */

function DisksTab({ t }: { t: (k: string) => string }) {
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

/* ───────────────── SMART Section ───────────────── */

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

/* ───────────────── Mount/Unmount Dialog ───────────────── */

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

/* ───────────────── Disk Card ───────────────── */

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

          {/* Mount/Unmount Buttons */}
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

          {/* SMART Section */}
          {isDisk && <SmartSection device={disk.name} t={t} />}
        </CardContent>
      </Card>

      {showMount && <MountDialog disk={disk} open={showMount} onClose={() => setShowMount(false)} t={t} />}
      {showUnmount && <UnmountConfirm disk={disk} open={showUnmount} onClose={() => setShowUnmount(false)} t={t} />}
      {showSpinDown && <SpinDownConfirm disk={disk} open={showSpinDown} onClose={() => setShowSpinDown(false)} t={t} />}
    </>
  );
}

/* ───────────────── Mountpoints Table ───────────────── */

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

/* ───────────────────── RAID Tab ───────────────────── */

function RAIDTab({ t }: { t: (k: string) => string }) {
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

/* ───────────────────── LVM Tab ───────────────────── */

function LVMTab({ t }: { t: (k: string) => string }) {
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

/* ───────────────────── ZFS Tab ───────────────────── */

function ZFSTab({ t }: { t: (k: string) => string }) {
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

/* ───────────────── Shared ───────────────── */

function InfoItem({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className={`text-sm font-medium ${color ?? "text-foreground"}`}>{value}</p>
    </div>
  );
}
