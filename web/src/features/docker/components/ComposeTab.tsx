import { useTranslation } from "@/hooks/useTranslation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchComposeProjects, controlComposeProject } from "@/features/docker/api";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/stores/toast";
import { ComposeRow } from "./ComposeRow";

interface ComposeTabProps {
  onViewLogs: (name: string) => void;
  onEditFile: (path: string, name: string) => void;
}

export function ComposeTab({ onViewLogs, onEditFile }: ComposeTabProps) {
  const t = useTranslation();
  const queryClient = useQueryClient();
  const toast = useToast();

  const projectsQuery = useQuery({ queryKey: ["compose-projects"], queryFn: fetchComposeProjects });

  const controlMutation = useMutation({
    mutationFn: ({ name, action, filePath }: { name: string; action: "up" | "down" | "restart"; filePath?: string }) =>
      controlComposeProject(name, action, filePath),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["compose-projects"] });
      queryClient.invalidateQueries({ queryKey: ["compose-services"] });
      toast.success(t("docker.composeAction").replace("{action}", variables.action));
    },
    onError: (_err, variables) => {
      toast.error(t("docker.composeActionFailed").replace("{action}", variables.action));
    },
  });

  const projects = projectsQuery.data?.data ?? [];

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {projectsQuery.isLoading
          ? t("docker.loadingCompose")
          : t("docker.projectCount").replace("{count}", String(projects.length))}
      </p>

      {projectsQuery.isError && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">{t("docker.failedCompose")}</p>
          </CardContent>
        </Card>
      )}

      {projects.length === 0 && !projectsQuery.isLoading && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">{t("docker.noCompose")}</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {projects.map((project) => (
          <ComposeRow
            key={project.name}
            project={project}
            onAction={(action) => controlMutation.mutate({ name: project.name, action, filePath: project.configFile })}
            onViewLogs={() => onViewLogs(project.name)}
            onEditFile={() => {
              if (project.configFile) {
                onEditFile(project.configFile, project.name);
              } else {
                toast.error(t("docker.noConfigPath"));
              }
            }}
            isPending={controlMutation.isPending}
          />
        ))}
      </div>
    </div>
  );
}
