import { useQuery } from "@tanstack/react-query";
import { fetchDisks } from "@/features/storage/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HardDrive, Database } from "lucide-react";

export default function StoragePage() {
  const disksQuery = useQuery({
    queryKey: ["disks"],
    queryFn: fetchDisks,
  });

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Storage</h1>
        <p className="text-muted-foreground">Read-only disk information from your system.</p>
      </div>

      {disksQuery.isLoading && <p className="text-sm text-muted-foreground">Loading disks...</p>}

      {disksQuery.isError && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">Failed to load disk information.</p>
          </CardContent>
        </Card>
      )}

      {disksQuery.data?.data && disksQuery.data.data.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">No disks detected.</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {disksQuery.data?.data?.map((disk) => (
          <Card key={disk.name}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{disk.name}</CardTitle>
              {disk.type === "disk" ? (
                <HardDrive className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Database className="h-4 w-4 text-muted-foreground" />
              )}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{disk.size || "N/A"}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {disk.model || "Unknown model"} &middot; {disk.type}
              </p>
              {disk.mountpoint && (
                <p className="text-xs text-muted-foreground mt-1">
                  Mount: {disk.mountpoint}
                </p>
              )}
              {disk.fstype && (
                <p className="text-xs text-muted-foreground">
                  FS: {disk.fstype}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
