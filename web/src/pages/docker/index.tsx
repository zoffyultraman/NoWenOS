import { useState } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchContainers,
  controlContainer,
  fetchContainerLogs,
  fetchImages,
  pullImage,
  removeImage,
  fetchComposeProjects,
  fetchComposeServices,
  controlComposeProject,
  fetchComposeLogs,
  readComposeFile,
  writeComposeFile,
  validateComposeFile,
  deployComposeFile,
} from "@/features/docker/api";
import type { ContainerInfo, ComposeProject } from "@/features/docker/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/stores/toast";
import {
  Container,
  Play,
  Square,
  RotateCcw,
  ScrollText,
  X,
  Download,
  Trash2,
  HardDrive,
  Layers,
  ChevronDown,
  ChevronRight,
  FileCode,
  Save,
  CheckCircle,
  Rocket,
} from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export default function DockerPage() {
  const t = useTranslation();
  const [activeTab, setActiveTab] = useState<"containers" | "images" | "compose">("containers");
  const [logsContainer, setLogsContainer] = useState<{ id: string; name: string } | null>(null);
  const [logsCompose, setLogsCompose] = useState<string | null>(null);
  const [editingFile, setEditingFile] = useState<{ path: string; name: string } | null>(null);

  return (
    <div className="space-y-4 p-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("docker.title")}</h1>
        <p className="text-muted-foreground">{t("docker.subtitle")}</p>
      </div>

      <div className="flex gap-2">
        <Button
          variant={activeTab === "containers" ? "default" : "outline"}
          onClick={() => setActiveTab("containers")}
        >
          <Container className="mr-2 h-4 w-4" />
          {t("docker.containers")}
        </Button>
        <Button
          variant={activeTab === "images" ? "default" : "outline"}
          onClick={() => setActiveTab("images")}
        >
          <HardDrive className="mr-2 h-4 w-4" />
          {t("docker.images")}
        </Button>
        <Button
          variant={activeTab === "compose" ? "default" : "outline"}
          onClick={() => setActiveTab("compose")}
        >
          <Layers className="mr-2 h-4 w-4" />
          {t("docker.compose")}
        </Button>
      </div>

      {activeTab === "containers" && (
        <ContainersTab onViewLogs={(id, name) => setLogsContainer({ id, name })} />
      )}
      {activeTab === "images" && <ImagesTab />}
      {activeTab === "compose" && (
        <ComposeTab
          onViewLogs={(name) => setLogsCompose(name)}
          onEditFile={(path, name) => setEditingFile({ path, name })}
        />
      )}

      {logsContainer && (
        <ContainerLogsModal
          id={logsContainer.id}
          name={logsContainer.name}
          onClose={() => setLogsContainer(null)}
        />
      )}
      {logsCompose && (
        <ComposeLogsModal
          name={logsCompose}
          onClose={() => setLogsCompose(null)}
        />
      )}
      {editingFile && (
        <FileEditorModal
          path={editingFile.path}
          name={editingFile.name}
          onClose={() => setEditingFile(null)}
        />
      )}
    </div>
  );
}

// ── Containers Tab ──

function ContainersTab({ onViewLogs }: { onViewLogs: (id: string, name: string) => void }) {
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
function ContainerRow({
  container, onAction, onViewLogs, isPending,
}: {
  container: ContainerInfo;
  onAction: (action: "start" | "stop" | "restart") => void;
  onViewLogs: () => void;
  isPending: boolean;
}) {
  const t = useTranslation();
  return (
    <Card>
      <CardContent className="flex items-center justify-between py-4">
        <div className="flex items-center gap-3">
          <div className={"h-2.5 w-2.5 rounded-full " + (container.state === "running" ? "bg-green-500" : "bg-slate-300")} />
          <div>
            <p className="text-sm font-medium">{container.name}</p>
            <p className="text-xs text-muted-foreground">{container.image}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={container.state === "running"
            ? "rounded-full border border-green-500/20 bg-green-500/10 px-2.5 py-0.5 text-xs font-medium text-green-400"
            : "rounded-full border border-slate-500/20 bg-slate-500/10 px-2.5 py-0.5 text-xs font-medium text-muted-foreground"}>
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

// ── Images Tab ──

function ImagesTab() {
  const t = useTranslation();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [pullName, setPullName] = useState("");
  const [removeImageConfirm, setRemoveImageConfirm] = useState<{ id: string; name: string } | null>(null);

  const imagesQuery = useQuery({ queryKey: ["images"], queryFn: fetchImages });

  const pullMutation = useMutation({
    mutationFn: () => pullImage(pullName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["images"] });
      toast.success(t("docker.pullSuccess"));
      setPullName("");
    },
    onError: () => toast.error(t("docker.pullFailed")),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => removeImage(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["images"] });
      toast.success(t("docker.imageRemoved"));
    },
    onError: () => toast.error(t("docker.removeFailed")),
  });

  const images = imagesQuery.data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder={t("docker.pullPlaceholder")}
          value={pullName}
          onChange={(e) => setPullName(e.target.value)}
          className="max-w-sm"
        />
        <Button onClick={() => pullMutation.mutate()} disabled={!pullName || pullMutation.isPending}>
          <Download className="mr-2 h-4 w-4" /> {t("docker.pull")}
        </Button>
      </div>

      {imagesQuery.isError && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">{t("docker.failedImages")}</p>
          </CardContent>
        </Card>
      )}

      {images.length === 0 && !imagesQuery.isLoading && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">{t("docker.noImages")}</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {images.map((image) => (
          <Card key={image.id}>
            <CardContent className="flex items-center justify-between py-4">
              <div>
                <p className="text-sm font-medium">{image.repository}:{image.tag}</p>
                <p className="text-xs text-muted-foreground">{image.id} | {image.size} | {image.created}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setRemoveImageConfirm({ id: image.id, name: `${image.repository}:${image.tag}` })} disabled={removeMutation.isPending} className="h-8 w-8 p-0">
                <Trash2 className="h-4 w-4 text-red-600" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
      <ConfirmDialog
        open={!!removeImageConfirm}
        onClose={() => setRemoveImageConfirm(null)}
        onConfirm={() => {
          if (removeImageConfirm) {
            removeMutation.mutate(removeImageConfirm.id);
            setRemoveImageConfirm(null);
          }
        }}
        title={t("common.delete")}
        message={`${t("common.delete")} "${removeImageConfirm?.name ?? ""}"?`}
        loading={removeMutation.isPending}
      />
    </div>
  );
}

// ── Compose Tab ──

function ComposeTab({ onViewLogs, onEditFile }: { onViewLogs: (name: string) => void; onEditFile: (path: string, name: string) => void }) {
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

function ComposeRow({
  project, onAction, onViewLogs, onEditFile, isPending,
}: {
  project: ComposeProject;
  onAction: (action: "up" | "down" | "restart") => void;
  onViewLogs: () => void;
  onEditFile: () => void;
  isPending: boolean;
}) {
  const t = useTranslation();
  const [expanded, setExpanded] = useState(false);
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            <div className={"h-2.5 w-2.5 rounded-full " + (isUp ? "bg-green-500" : "bg-slate-300")} />
            <div>
              <p className="text-sm font-medium">{project.name}</p>
              <p className="text-xs text-muted-foreground">
                {project.services} {t("docker.services")} | {project.status}
                {project.configFile && (" | " + project.configFile)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={onEditFile} className="h-8 px-2 text-xs" title={t("docker.edit")}>
              <FileCode className="mr-1 h-3 w-3" /> {t("docker.edit")}
            </Button>
            {!isUp ? (
              <Button variant="ghost" size="sm" onClick={() => onAction("up")} disabled={isPending} className="h-8 px-2 text-xs">
                <Play className="mr-1 h-3 w-3 text-green-600" /> {t("docker.up")}
              </Button>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={() => onAction("down")} disabled={isPending} className="h-8 px-2 text-xs">
                  <Square className="mr-1 h-3 w-3 text-red-600" /> {t("docker.down")}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onAction("restart")} disabled={isPending} className="h-8 px-2 text-xs">
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
              <div key={svc.name} className="flex items-center justify-between rounded-lg border px-3 py-2">
                <div className="flex items-center gap-3">
                  <div className={"h-2 w-2 rounded-full " + (svc.state === "running" ? "bg-green-500" : "bg-slate-300")} />
                  <div>
                    <p className="text-sm font-medium">{svc.name}</p>
                    <p className="text-xs text-muted-foreground">{svc.image}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {svc.ports && (
                    <span className="text-xs text-muted-foreground font-mono">{svc.ports}</span>
                  )}
                  <span className={"rounded-full px-2 py-0.5 text-xs " + (svc.state === "running" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600")}>
                    {svc.state}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ContainerLogsModal({ id, name, onClose }: { id: string; name: string; onClose: () => void }) {
  const t = useTranslation();
  const logsQuery = useQuery({
    queryKey: ["container-logs", id],
    queryFn: () => fetchContainerLogs(id, 200),
  });
  const logs = logsQuery.data?.data?.logs ?? "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <Card className="mx-4 max-h-[80vh] w-full max-w-3xl">
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

function ComposeLogsModal({ name, onClose }: { name: string; onClose: () => void }) {
  const t = useTranslation();
  const logsQuery = useQuery({
    queryKey: ["compose-logs", name],
    queryFn: () => fetchComposeLogs(name, 200),
  });
  const logs = logsQuery.data?.data?.logs ?? "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <Card className="mx-4 max-h-[80vh] w-full max-w-3xl">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-lg">{t("docker.composeLogs")}: {name}</CardTitle>
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

// ── Compose File Editor Modal ──

function FileEditorModal({ path, name, onClose }: { path: string; name: string; onClose: () => void }) {
  const t = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [content, setContent] = useState("");
  const [result, setResult] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const fileQuery = useQuery({
    queryKey: ["compose-file", path],
    queryFn: () => readComposeFile(path),
  });

  const serverContent = fileQuery.data?.data?.content;
  if (serverContent !== undefined && content === "" && serverContent !== "") {
    setContent(serverContent);
  }

  const saveMutation = useMutation({
    mutationFn: () => writeComposeFile(path, content),
    onSuccess: () => {
      toast.success(t("docker.fileSaved"));
      setResult({ type: "success", message: t("docker.fileSaved") });
    },
    onError: (err: Error) => {
      toast.error(t("docker.saveFailed"));
      setResult({ type: "error", message: err.message || t("docker.saveFailed") });
    },
  });

  const validateMutation = useMutation({
    mutationFn: async () => {
      await writeComposeFile(path, content);
      return validateComposeFile(path);
    },
    onSuccess: () => {
      setResult({ type: "success", message: t("docker.validatePassed") });
      toast.success(t("docker.validateSuccess"));
    },
    onError: (err: Error & { response?: { data?: { error?: string } } }) => {
      const msg = err?.response?.data?.error || err?.message || t("docker.validateFailed");
      setResult({ type: "error", message: msg });
      toast.error(t("docker.validateFailed"));
    },
  });

  const deployMutation = useMutation({
    mutationFn: async () => {
      await writeComposeFile(path, content);
      return deployComposeFile(path);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["compose-projects"] });
      queryClient.invalidateQueries({ queryKey: ["compose-services"] });
      setResult({ type: "success", message: t("docker.deploySuccess") });
      toast.success(t("docker.deployToastSuccess"));
    },
    onError: (err: Error & { response?: { data?: { error?: string } } }) => {
      const msg = err?.response?.data?.error || err?.message || t("docker.deployFailed");
      setResult({ type: "error", message: msg });
      toast.error(t("docker.deployFailed"));
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <Card className="mx-4 flex max-h-[85vh] w-full max-w-4xl flex-col">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileCode className="h-5 w-5" />
              {t("docker.edit")}: {name}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1 font-mono">{path}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}><X className="h-4 w-4" /></Button>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col gap-3 overflow-hidden">
          {fileQuery.isLoading && <p className="text-sm text-muted-foreground">{t("docker.loadingFile")}</p>}
          {fileQuery.isError && <p className="text-sm text-destructive">{t("docker.failedFile")}</p>}

          {!fileQuery.isLoading && !fileQuery.isError && (
            <>
              <textarea
                className="flex-1 min-h-[400px] w-full rounded-lg border bg-slate-950 p-4 font-mono text-xs text-slate-50 resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                spellCheck={false}
              />

              {result && (
                <div className={"rounded-lg p-3 text-sm " + (result.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200")}>
                  <pre className="whitespace-pre-wrap break-all text-xs">{result.message}</pre>
                </div>
              )}

              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {content.split("\n").length} {t("docker.lines")}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => saveMutation.mutate()}
                    disabled={saveMutation.isPending}
                  >
                    <Save className="mr-1 h-3 w-3" />
                    {saveMutation.isPending ? t("docker.saving") : t("docker.save")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => validateMutation.mutate()}
                    disabled={validateMutation.isPending}
                  >
                    <CheckCircle className="mr-1 h-3 w-3" />
                    {validateMutation.isPending ? t("docker.validating") : t("docker.validate")}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => deployMutation.mutate()}
                    disabled={deployMutation.isPending}
                  >
                    <Rocket className="mr-1 h-3 w-3" />
                    {deployMutation.isPending ? t("docker.deploying") : t("docker.deploy")}
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}





