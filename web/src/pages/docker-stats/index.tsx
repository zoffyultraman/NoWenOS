import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "@/hooks/useTranslation";
import {
  fetchContainerStats,
  fetchStatsHistory,
} from "@/features/dockerstats/api";
import type { ContainerStats, ContainerStatsHistory } from "@/features/dockerstats/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Activity, ArrowLeft, Cpu, HardDrive, Network, Box } from "lucide-react";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(Math.max(bytes, 1)) / Math.log(1024));
  const val = bytes / Math.pow(1024, i);
  return `${val.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

function cpuColor(pct: number): string {
  if (pct >= 80) return "text-red-500";
  if (pct >= 50) return "text-yellow-500";
  return "text-green-500";
}

function memColor(pct: number): string {
  if (pct >= 85) return "text-red-500";
  if (pct >= 60) return "text-yellow-500";
  return "text-green-500";
}

function cpuBg(pct: number): string {
  if (pct >= 80) return "bg-red-500";
  if (pct >= 50) return "bg-yellow-500";
  return "bg-green-500";
}

function memBg(pct: number): string {
  if (pct >= 85) return "bg-red-500";
  if (pct >= 60) return "bg-yellow-500";
  return "bg-green-500";
}

// ── SVG Sparkline ──

function Sparkline({
  data,
  color = "#3b82f6",
  width = 160,
  height = 32,
}: {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
}) {
  if (data.length < 2) {
    return (
      <div
        className="flex items-center justify-center text-xs text-muted-foreground"
        style={{ width, height }}
      >
        --
      </div>
    );
  }
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const padding = 2;
  const w = width - padding * 2;
  const h = height - padding * 2;

  const points = data
    .map((v, i) => {
      const x = padding + (i / (data.length - 1)) * w;
      const y = padding + h - ((v - min) / range) * h;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} className="inline-block">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

// ── History Detail View ──

function HistoryDetail({
  containerId,
  containerName,
  onBack,
}: {
  containerId: string;
  containerName: string;
  onBack: () => void;
}) {
  const t = useTranslation();
  const [minutes, setMinutes] = useState(60);

  const { data: historyData, isLoading } = useQuery({
    queryKey: ["docker-stats-history", containerId, minutes],
    queryFn: () => fetchStatsHistory(containerId, minutes),
    refetchInterval: 10000,
  });

  const history = historyData?.data ?? [];

  const cpuData = useMemo(() => history.map((h) => h.cpuPercent), [history]);
  const memData = useMemo(() => history.map((h) => h.memoryPercent), [history]);
  const netRxData = useMemo(() => history.map((h) => h.netRx), [history]);
  const netTxData = useMemo(() => history.map((h) => h.netTx), [history]);
  const blockReadData = useMemo(() => history.map((h) => h.blockRead), [history]);
  const blockWriteData = useMemo(() => history.map((h) => h.blockWrite), [history]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-1" />
          {t("common.close")}
        </Button>
        <h2 className="text-lg font-semibold truncate">{containerName}</h2>
        <span className="text-xs text-muted-foreground truncate font-mono">{containerId}</span>
      </div>

      <div className="flex gap-2">
        {[15, 30, 60, 120].map((m) => (
          <Button
            key={m}
            variant={minutes === m ? "default" : "outline"}
            size="sm"
            onClick={() => setMinutes(m)}
          >
            {m}m
          </Button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">{t("common.loading")}</p>
      ) : history.length === 0 ? (
        <p className="text-muted-foreground">{t("dockerStats.noHistory")}</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* CPU Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Cpu className="w-4 h-4" />
                {t("dockerStats.cpuHistory")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-2">
                <Sparkline data={cpuData} color="#3b82f6" width={280} height={48} />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{t("dockerStats.avg")}: {(cpuData.reduce((a, b) => a + b, 0) / cpuData.length).toFixed(1)}%</span>
                <span>{t("dockerStats.max")}: {Math.max(...cpuData).toFixed(1)}%</span>
              </div>
            </CardContent>
          </Card>

          {/* Memory Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <HardDrive className="w-4 h-4" />
                {t("dockerStats.memHistory")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-2">
                <Sparkline data={memData} color="#8b5cf6" width={280} height={48} />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{t("dockerStats.avg")}: {(memData.reduce((a, b) => a + b, 0) / memData.length).toFixed(1)}%</span>
                <span>{t("dockerStats.max")}: {Math.max(...memData).toFixed(1)}%</span>
              </div>
            </CardContent>
          </Card>

          {/* Network Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Network className="w-4 h-4" />
                {t("dockerStats.netHistory")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-1">
                <p className="text-xs text-muted-foreground mb-1">{t("dockerStats.rx")}</p>
                <Sparkline data={netRxData} color="#22c55e" width={280} height={40} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">{t("dockerStats.tx")}</p>
                <Sparkline data={netTxData} color="#f97316" width={280} height={40} />
              </div>
            </CardContent>
          </Card>

          {/* Block I/O Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Box className="w-4 h-4" />
                {t("dockerStats.blockHistory")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-1">
                <p className="text-xs text-muted-foreground mb-1">{t("dockerStats.read")}</p>
                <Sparkline data={blockReadData} color="#06b6d4" width={280} height={40} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">{t("dockerStats.write")}</p>
                <Sparkline data={blockWriteData} color="#ec4899" width={280} height={40} />
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// ── Main Page ──

export default function DockerStatsPage() {
  const t = useTranslation();
  const [selectedContainer, setSelectedContainer] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const { data: statsData, isLoading, error } = useQuery({
    queryKey: ["docker-stats"],
    queryFn: fetchContainerStats,
    refetchInterval: 10000,
  });

  const stats = statsData?.data ?? [];

  if (selectedContainer) {
    return (
      <div className="p-4">
        <HistoryDetail
          containerId={selectedContainer.id}
          containerName={selectedContainer.name}
          onBack={() => setSelectedContainer(null)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Activity className="w-6 h-6" />
          {t("dockerStats.title")}
        </h1>
        <p className="text-muted-foreground">{t("dockerStats.subtitle")}</p>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">{t("dockerStats.loading")}</p>
      ) : error ? (
        <p className="text-red-500">{t("dockerStats.failed")}</p>
      ) : stats.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {t("dockerStats.noContainers")}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="p-3 font-medium">{t("dockerStats.containerName")}</th>
                    <th className="p-3 font-medium text-right">{t("dockerStats.cpu")}</th>
                    <th className="p-3 font-medium text-right">{t("dockerStats.memory")}</th>
                    <th className="p-3 font-medium text-right">{t("dockerStats.netRx")}</th>
                    <th className="p-3 font-medium text-right">{t("dockerStats.netTx")}</th>
                    <th className="p-3 font-medium text-right">{t("dockerStats.blockRead")}</th>
                    <th className="p-3 font-medium text-right">{t("dockerStats.blockWrite")}</th>
                    <th className="p-3 font-medium text-right">{t("dockerStats.pids")}</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.map((s) => (
                    <tr
                      key={s.containerId}
                      className="border-b last:border-b-0 hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() =>
                        setSelectedContainer({ id: s.containerId, name: s.name })
                      }
                    >
                      <td className="p-3">
                        <div className="font-medium">{s.name}</div>
                        <div className="text-xs text-muted-foreground font-mono truncate max-w-[120px]">
                          {s.containerId}
                        </div>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-2 rounded-full bg-muted overflow-hidden">
                            <div
                              className={`h-full rounded-full ${cpuBg(s.cpuPercent)}`}
                              style={{ width: `${Math.min(s.cpuPercent, 100)}%` }}
                            />
                          </div>
                          <span className={`font-mono ${cpuColor(s.cpuPercent)}`}>
                            {s.cpuPercent.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-2 rounded-full bg-muted overflow-hidden">
                            <div
                              className={`h-full rounded-full ${memBg(s.memoryPercent)}`}
                              style={{ width: `${Math.min(s.memoryPercent, 100)}%` }}
                            />
                          </div>
                          <span className={`font-mono ${memColor(s.memoryPercent)}`}>
                            {s.memoryPercent.toFixed(1)}%
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatBytes(s.memoryUsage)} / {formatBytes(s.memoryLimit)}
                        </div>
                      </td>
                      <td className="p-3 text-right font-mono text-green-500">
                        {formatBytes(s.netRx)}
                      </td>
                      <td className="p-3 text-right font-mono text-orange-500">
                        {formatBytes(s.netTx)}
                      </td>
                      <td className="p-3 text-right font-mono text-cyan-500">
                        {formatBytes(s.blockRead)}
                      </td>
                      <td className="p-3 text-right font-mono text-pink-500">
                        {formatBytes(s.blockWrite)}
                      </td>
                      <td className="p-3 text-right font-mono">{s.pids}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
