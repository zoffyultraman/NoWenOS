import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchLogs, fetchLogSources } from "@/features/logs/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

export default function LogsPage() {
  const [limit, setLimit] = useState(100);

  const logsQuery = useQuery({
    queryKey: ["logs", limit],
    queryFn: () => fetchLogs(undefined, limit),
  });

  const sourcesQuery = useQuery({
    queryKey: ["log-sources"],
    queryFn: fetchLogSources,
  });

  const entries = logsQuery.data?.data?.entries ?? [];
  const sources = sourcesQuery.data?.data ?? [];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Logs</h1>
          <p className="text-muted-foreground">
            {logsQuery.isLoading ? "Loading..." : `${entries.length} log entries`}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => logsQuery.refetch()}
          disabled={logsQuery.isLoading}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Sources info */}
      {sources.length > 0 && (
        <Card>
          <CardContent className="py-3">
            <p className="text-xs text-muted-foreground">
              Available log sources: {sources.join(", ")}
            </p>
          </CardContent>
        </Card>
      )}

      {logsQuery.isLoading && (
        <p className="text-sm text-muted-foreground">Loading logs...</p>
      )}

      {logsQuery.isError && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">Failed to load logs.</p>
          </CardContent>
        </Card>
      )}

      {/* Limit controls */}
      <div className="flex gap-2">
        {[50, 100, 200, 500].map((n) => (
          <Button
            key={n}
            variant={limit === n ? "default" : "outline"}
            size="sm"
            onClick={() => setLimit(n)}
          >
            {n}
          </Button>
        ))}
      </div>

      {/* Log entries */}
      {entries.length === 0 && !logsQuery.isLoading && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">No log entries found.</p>
          </CardContent>
        </Card>
      )}

      {entries.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="max-h-[600px] overflow-y-auto">
              <div className="divide-y font-mono text-xs">
                <div className="grid grid-cols-[140px_60px_1fr] bg-muted px-4 py-2 font-medium text-muted-foreground">
                  <span>Timestamp</span>
                  <span>Level</span>
                  <span>Message</span>
                </div>
                {entries.map((entry, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-[140px_60px_1fr] px-4 py-1.5 hover:bg-muted/50"
                  >
                    <span className="text-muted-foreground">{entry.timestamp}</span>
                    <span>
                      <LogLevelBadge level={entry.level} />
                    </span>
                    <span className="break-all">{entry.message}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function LogLevelBadge({ level }: { level: string }) {
  const styles: Record<string, string> = {
    error: "bg-red-100 text-red-700",
    warn: "bg-yellow-100 text-yellow-700",
    info: "bg-blue-100 text-blue-700",
    debug: "bg-slate-100 text-slate-600",
  };

  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${
        styles[level] ?? styles.info
      }`}
    >
      {level}
    </span>
  );
}
