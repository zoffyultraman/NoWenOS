import { useState } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useQuery } from "@tanstack/react-query";
import { fetchComposeServices } from "@/features/docker/api";
import type { ComposeProject } from "@/features/docker/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Play, Square, RotateCcw, ScrollText,
  ChevronDown, ChevronRight, FileCode,
} from "lucide-react";

interface ComposeRowProps {
  project: ComposeProject;
  onAction: (action: "up" | "down" | "restart") => void;
  onViewLogs: () => void;
  onEditFile: () => void;
  isPending: boolean;
}

export function ComposeRow({ project, onAction, onViewLogs, onEditFile, isPending }: ComposeRowProps) {
  const t = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [composeConfirm, setComposeConfirm] = useState<{ action: "down" | "restart" } | null>(null);
  const servicesQuery = useQuery({
    queryKey: ["compose-services", project.name],
    queryFn: () => fetchComposeServices(project.name),
    enabled: expanded,
  });
  const services = servicesQuery.data?.data ?? [];
  const isUp = project.status.toLowerCase().includes("running") || project.status.toLowerCase().includes("up");

  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 cursor-pointer min-w-0" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />}
            <div className={"h-2.5 w-2.5 flex-shrink-0 rounded-full " + (isUp ? "bg-green-500" : "bg-muted-foreground/50")} />
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{project.name}</p>
              <p className="text-xs text-muted-foreground truncate">
                {project.services} {t("docker.services")} | {project.status}
                {project.configFile && (" | " + project.configFile)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button variant="ghost" size="sm" onClick={onEditFile} className="h-8 px-2 text-xs" title={t("docker.edit")}>
              <FileCode className="mr-1 h-3 w-3" /> <span className="hidden sm:inline">{t("docker.edit")}</span>
            </Button>
            {!isUp ? (
              <Button variant="ghost" size="sm" onClick={() => onAction("up")} disabled={isPending} className="h-8 px-2 text-xs">
                <Play className="mr-1 h-3 w-3 text-green-600" /> <span className="hidden sm:inline">{t("docker.up")}</span>
              </Button>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={() => setComposeConfirm({ action: "down" })} disabled={isPending} className="h-8 px-2 text-xs">
                  <Square className="mr-1 h-3 w-3 text-red-600" /> {t("docker.down")}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setComposeConfirm({ action: "restart" })} disabled={isPending} className="h-8 px-2 text-xs">
                  <RotateCcw className="mr-1 h-3 w-3 text-blue-600" /> {t("docker.restart")}
                </Button>
              </>
            )}
            <Button variant="ghost" size="sm" onClick={onViewLogs} className="h-8 w-8 p-0">
              <ScrollText className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {expanded && (
          <div className="mt-4 ml-7 space-y-2">
            {servicesQuery.isLoading && <p className="text-sm text-muted-foreground">{t("docker.loadingServices")}</p>}
            {servicesQuery.isError && <p className="text-sm text-destructive">{t("docker.failedServices")}</p>}
            {services.length === 0 && !servicesQuery.isLoading && (
              <p className="text-sm text-muted-foreground">{t("docker.noServices")}</p>
            )}
            {services.map((svc) => (
              <div key={svc.name} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-lg border px-3 py-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={"h-2 w-2 flex-shrink-0 rounded-full " + (svc.state === "running" ? "bg-green-500" : "bg-muted-foreground/50")} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{svc.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{svc.image}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {svc.ports && (
                    <span className="text-xs text-muted-foreground font-mono">{svc.ports}</span>
                  )}
                  <span className={"rounded-full px-2 py-0.5 text-xs " + (svc.state === "running" ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground")}>
                    {svc.state}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {composeConfirm && (
          <ConfirmDialog
            title={t("common.confirm")}
            message={t(composeConfirm.action === "down" ? "docker.composeDownConfirm" : "docker.composeRestartConfirm").replace("{name}", project.name)}
            onConfirm={() => { onAction(composeConfirm.action); setComposeConfirm(null); }}
            onCancel={() => setComposeConfirm(null)}
          />
        )}
      </CardContent>
    </Card>
  );
}
