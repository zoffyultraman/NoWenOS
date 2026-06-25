import { useTranslation } from "@/hooks/useTranslation";
import { useQuery } from "@tanstack/react-query";
import { fetchContainerLogs } from "@/features/docker/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface ContainerLogsModalProps {
  id: string;
  name: string;
  onClose: () => void;
}

export function ContainerLogsModal({ id, name, onClose }: ContainerLogsModalProps) {
  const t = useTranslation();
  const logsQuery = useQuery({
    queryKey: ["container-logs", id],
    queryFn: () => fetchContainerLogs(id, 200),
  });
  const logs = logsQuery.data?.data?.logs ?? "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 sm:p-4">
      <Card className="max-h-[80vh] w-full max-w-3xl">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-lg">{t("docker.logsTitle")}: {name}</CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}><X className="h-4 w-4" /></Button>
        </CardHeader>
        <CardContent>
          {logsQuery.isLoading && <p className="text-sm text-muted-foreground">{t("docker.loadingLogs")}</p>}
          {logsQuery.isError && <p className="text-sm text-destructive">{t("docker.failedLogs")}</p>}
          {logs && <pre className="max-h-[60vh] overflow-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-50">{logs}</pre>}
          {!logs && !logsQuery.isLoading && <p className="text-sm text-muted-foreground">{t("docker.noLogs")}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
