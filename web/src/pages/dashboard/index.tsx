import { useQuery } from "@tanstack/react-query";
import { fetchSystemInfo, fetchSystemStats, fetchNetworkStats, fetchProcesses } from "@/features/system/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Cpu, HardDrive, MemoryStick, Server, Clock, Network, List } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

export default function DashboardPage() {
  const t = useTranslation();
  const systemQuery = useQuery({ queryKey: ["system-info"], queryFn: fetchSystemInfo });
  const statsQuery = useQuery({ queryKey: ["system-stats"], queryFn: fetchSystemStats, refetchInterval: 5000 });
  const networkQuery = useQuery({ queryKey: ["network-stats"], queryFn: fetchNetworkStats, refetchInterval: 5000 });
  const processesQuery = useQuery({ queryKey: ["processes"], queryFn: () => fetchProcesses(30), refetchInterval: 10000 });

  const stats = statsQuery.data?.data;
  const network = networkQuery.data?.data;
  const processes = processesQuery.data?.data ?? [];

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("dashboard.title")}</h1>
        <p className="text-muted-foreground">{t("dashboard.subtitle")}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("dashboard.system")}</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{systemQuery.isLoading ? "..." : systemQuery.data?.data?.name ?? "NoWenOS"}</div>
            <p className="text-xs text-muted-foreground">v{systemQuery.data?.data?.version ?? "0.1.0"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("dashboard.apiStatus")}</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{systemQuery.isLoading ? "..." : systemQuery.isError ? t("dashboard.error") : t("dashboard.connected")}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("dashboard.uptime")}</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statsQuery.isLoading ? "..." : stats?.uptime ?? "N/A"}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("dashboard.cpu")}</CardTitle>
            <Cpu className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statsQuery.isLoading ? "..." : `${(stats?.cpu.usage ?? 0).toFixed(1)}%`}</div>
            <div className="mt-2 h-2 w-full rounded-full bg-muted"><div className="h-2 rounded-full bg-blue-500 transition-all" style={{ width: `${stats?.cpu.usage ?? 0}%` }} /></div>
            <p className="mt-1 text-xs text-muted-foreground">{stats?.cpu.cores ?? 0} {t("dashboard.cores")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("dashboard.memory")}</CardTitle>
            <MemoryStick className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statsQuery.isLoading ? "..." : `${(stats?.memory.usage ?? 0).toFixed(1)}%`}</div>
            <div className="mt-2 h-2 w-full rounded-full bg-muted"><div className="h-2 rounded-full bg-green-500 transition-all" style={{ width: `${stats?.memory.usage ?? 0}%` }} /></div>
            <p className="mt-1 text-xs text-muted-foreground">{stats?.memory.used ?? "N/A"} / {stats?.memory.total ?? "N/A"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("dashboard.disk")}</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statsQuery.isLoading ? "..." : `${(stats?.disk.usage ?? 0).toFixed(1)}%`}</div>
            <div className="mt-2 h-2 w-full rounded-full bg-muted"><div className="h-2 rounded-full bg-orange-500 transition-all" style={{ width: `${stats?.disk.usage ?? 0}%` }} /></div>
            <p className="mt-1 text-xs text-muted-foreground">{stats?.disk.used ?? "N/A"} / {stats?.disk.total ?? "N/A"}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{t("dashboard.network")}</CardTitle>
          <Network className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {networkQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">{t("dashboard.loading")}</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <div><p className="text-sm text-muted-foreground">{t("dashboard.totalRx")}</p><p className="text-2xl font-bold">{network?.totalRx ?? "N/A"}</p></div>
              <div><p className="text-sm text-muted-foreground">{t("dashboard.totalTx")}</p><p className="text-2xl font-bold">{network?.totalTx ?? "N/A"}</p></div>
            </div>
          )}
          {network && network.interfaces.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">{t("dashboard.interfaces")}</p>
              {network.interfaces.map((iface) => (
                <div key={iface.name} className="flex items-center justify-between rounded-md bg-muted px-3 py-2 text-sm">
                  <span className="font-medium">{iface.name}</span>
                  <div className="flex gap-4 text-muted-foreground"><span>↓ {iface.rx}</span><span>↑ {iface.tx}</span></div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{t("dashboard.topProcesses")}</CardTitle>
          <List className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {processesQuery.isLoading && <p className="text-sm text-muted-foreground">{t("dashboard.loadingProcesses")}</p>}
          {processesQuery.isError && <p className="text-sm text-destructive">{t("dashboard.failedProcesses")}</p>}
          {processes.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs font-medium text-muted-foreground">
                    <th className="pb-2 pr-4">PID</th>
                    <th className="pb-2 pr-4">Name</th>
                    <th className="pb-2 pr-4 text-right">CPU %</th>
                    <th className="pb-2 pr-4 text-right">Memory</th>
                    <th className="pb-2">Command</th>
                  </tr>
                </thead>
                <tbody>
                  {processes.map((proc) => (
                    <tr key={proc.pid} className="border-b border-muted/50 hover:bg-muted/30 transition-colors">
                      <td className="py-1.5 pr-4 font-mono text-xs">{proc.pid}</td>
                      <td className="py-1.5 pr-4 font-medium">{proc.name}</td>
                      <td className="py-1.5 pr-4 text-right font-mono text-xs">{proc.cpu > 0 ? proc.cpu.toFixed(1) + "%" : "\u2014"}</td>
                      <td className="py-1.5 pr-4 text-right font-mono text-xs">{proc.memory > 0 ? proc.memory.toFixed(1) + " MB" : "\u2014"}</td>
                      <td className="py-1.5 text-xs text-muted-foreground truncate max-w-xs">{proc.command}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {processes.length === 0 && !processesQuery.isLoading && <p className="text-sm text-muted-foreground">{t("dashboard.noProcesses")}</p>}
        </CardContent>
      </Card>

      {systemQuery.isError && (
        <Card className="border-destructive"><CardContent className="pt-6"><p className="text-sm text-destructive">{t("dashboard.failedSystem")}</p></CardContent></Card>
      )}
    </div>
  );
}
