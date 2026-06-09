import { useQuery } from "@tanstack/react-query";
import { fetchHardware } from "@/features/system/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Cpu, HardDrive, MemoryStick, CircuitBoard, Server, Thermometer } from "lucide-react";

export default function SystemPage() {
    const hwQuery = useQuery({ queryKey: ["hardware"], queryFn: fetchHardware, refetchInterval: 30000 });
  const hw = hwQuery.data?.data;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">System Info</h1>
        <p className="text-muted-foreground">Hardware and system details.</p>
      </div>

      {hwQuery.isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
      {hwQuery.isError && (
        <Card className="border-destructive">
          <CardContent className="pt-6"><p className="text-sm text-destructive">Failed to load system info.</p></CardContent>
        </Card>
      )}

      {hw && (
        <>
          {/* Overview */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <InfoCard icon={<Server className="h-5 w-5" />} label="Hostname" value={hw.hostname || "N/A"} />
            <InfoCard icon={<Cpu className="h-5 w-5" />} label="CPU" value={hw.cpuModel} sub={`${hw.cpuCores} cores`} />
            <InfoCard icon={<MemoryStick className="h-5 w-5" />} label="Memory" value={hw.totalMemory || "N/A"} />
            <InfoCard icon={<HardDrive className="h-5 w-5" />} label="Architecture" value={hw.arch} sub={hw.os} />
          </div>

          {/* CPU Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Cpu className="h-5 w-5" /> CPU
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                <DetailRow label="Model" value={hw.cpuModel} />
                <DetailRow label="Cores" value={String(hw.cpuCores)} />
              </div>
            </CardContent>
          </Card>

          {/* System */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Server className="h-5 w-5" /> System
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                <DetailRow label="Hostname" value={hw.hostname} />
                <DetailRow label="OS" value={hw.os} />
                <DetailRow label="Arch" value={hw.arch} />
                <DetailRow label="Kernel" value={hw.kernel || "N/A"} />
                <DetailRow label="Go Version" value={hw.goVersion} />
                <DetailRow label="Memory" value={hw.totalMemory || "N/A"} />
              </div>
            </CardContent>
          </Card>

          {/* Motherboard */}
          {(hw.boardVendor || hw.boardName) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CircuitBoard className="h-5 w-5" /> Motherboard
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2">
                  <DetailRow label="Vendor" value={hw.boardVendor || "N/A"} />
                  <DetailRow label="Name" value={hw.boardName || "N/A"} />
                  <DetailRow label="BIOS Vendor" value={hw.biosVendor || "N/A"} />
                  <DetailRow label="BIOS Version" value={hw.biosVersion || "N/A"} />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Temperature */}
          {hw.temperature && hw.temperature.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Thermometer className="h-5 w-5" /> Temperature
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {hw.temperature.map((zone, i) => (
                    <div key={i} className="flex items-center justify-between rounded-lg border px-4 py-3">
                      <span className="text-sm font-medium">{zone.type}</span>
                      <span className="text-sm font-mono">{zone.temp}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function InfoCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-3 mb-2 text-muted-foreground">{icon}<span className="text-sm">{label}</span></div>
        <p className="text-lg font-bold truncate">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-muted px-4 py-2.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-right max-w-[60%] truncate">{value}</span>
    </div>
  );
}
