import { useTranslation } from "@/hooks/useTranslation";
import type { ContainerInfo } from "@/features/docker/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, Square, RotateCcw, ScrollText } from "lucide-react";

interface ContainerRowProps {
  container: ContainerInfo;
  onAction: (action: "start" | "stop" | "restart") => void;
  onViewLogs: () => void;
  isPending: boolean;
}

export function ContainerRow({ container, onAction, onViewLogs, isPending }: ContainerRowProps) {
  const t = useTranslation();
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between py-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className={"h-2.5 w-2.5 flex-shrink-0 rounded-full " + (container.state === "running" ? "bg-green-500" : "bg-muted-foreground/50")} />
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{container.name}</p>
            <p className="text-xs text-muted-foreground truncate">{container.image}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={container.state === "running"
            ? "rounded-full border border-green-500/20 bg-green-500/10 px-2.5 py-0.5 text-xs font-medium text-green-400"
            : "rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground"}>
            {container.state === "running" ? t("docker.running") : container.state}
          </span>
          {container.state === "running" ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => onAction("stop")} disabled={isPending} className="h-8 w-8 p-0">
                <Square className="h-4 w-4 text-red-600" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onAction("restart")} disabled={isPending} className="h-8 w-8 p-0">
                <RotateCcw className="h-4 w-4 text-blue-600" />
              </Button>
            </>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => onAction("start")} disabled={isPending} className="h-8 w-8 p-0">
              <Play className="h-4 w-4 text-green-600" />
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onViewLogs} className="h-8 w-8 p-0">
            <ScrollText className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
