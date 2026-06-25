import { useState } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchContainers, controlContainer } from "@/features/docker/api";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/stores/toast";
import { ContainerRow } from "./ContainerRow";

interface ContainersTabProps {
  onViewLogs: (id: string, name: string) => void;
}

export function ContainersTab({ onViewLogs }: ContainersTabProps) {
  const t = useTranslation();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [confirmAction, setConfirmAction] = useState<{ id: string; name: string; action: "stop" | "restart" } | null>(null);

  const containersQuery = useQuery({ queryKey: ["containers"], queryFn: fetchContainers });

  const controlMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "start" | "stop" | "restart" }) =>
      controlContainer(id, action),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["containers"] });
      toast.success(t("docker.containerAction").replace("{action}", variables.action));
    },
    onError: (_err, variables) => {
      toast.error(t("docker.containerActionFailed").replace("{action}", variables.action));
    },
  });

  const containers = containersQuery.data?.data ?? [];
  const running = containers.filter((c) => c.state === "running").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        {containersQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">{t("docker.loadingContainers")}</p>
        ) : (
          <>
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-green-500/10 px-2.5 py-1 text-xs font-medium text-green-400">
              <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
              {running} {t("docker.running")}
            </span>
            <span className="rounded-lg bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
              {containers.length} {t("docker.total")}
            </span>
          </>
        )}
      </div>

      {containersQuery.isError && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">{t("docker.failedContainers")}</p>
          </CardContent>
        </Card>
      )}

      {containers.length === 0 && !containersQuery.isLoading && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">{t("docker.noContainers")}</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {containers.map((container) => (
          <ContainerRow
            key={container.id}
            container={container}
            onAction={(action) => {
              if (action === "start") {
                controlMutation.mutate({ id: container.id, action });
              } else {
                setConfirmAction({ id: container.id, name: container.name, action });
              }
            }}
            onViewLogs={() => onViewLogs(container.id, container.name)}
            isPending={controlMutation.isPending}
          />
        ))}
      </div>
      <ConfirmDialog
        open={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => {
          if (confirmAction) {
            controlMutation.mutate({ id: confirmAction.id, action: confirmAction.action });
            setConfirmAction(null);
          }
        }}
        title={t("docker.confirmAction").replace("{action}", confirmAction?.action ?? "")}
        message={t("docker.confirmActionMessage").replace("{action}", confirmAction?.action ?? "").replace("{name}", confirmAction?.name ?? "")}
        loading={controlMutation.isPending}
        variant="danger"
      />
    </div>
  );
}
