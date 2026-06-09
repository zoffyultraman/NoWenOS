import { useState } from "react";
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

export default function DockerPage() {
  const [activeTab, setActiveTab] = useState<"containers" | "images" | "compose">("containers");
  const [logsContainer, setLogsContainer] = useState<{ id: string; name: string } | null>(null);
  const [logsCompose, setLogsCompose] = useState<string | null>(null);
  const [editingFile, setEditingFile] = useState<{ path: string; name: string } | null>(null);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Docker</h1>
        <p className="text-muted-foreground">Manage containers, images, and Compose projects</p>
      </div>

      <div className="flex gap-2">
        <Button
          variant={activeTab === "containers" ? "default" : "outline"}
          onClick={() => setActiveTab("containers")}
        >
          <Container className="mr-2 h-4 w-4" />
          Containers
        </Button>
        <Button
          variant={activeTab === "images" ? "default" : "outline"}
          onClick={() => setActiveTab("images")}
        >
          <HardDrive className="mr-2 h-4 w-4" />
          Images
        </Button>
        <Button
          variant={activeTab === "compose" ? "default" : "outline"}
          onClick={() => setActiveTab("compose")}
        >
          <Layers className="mr-2 h-4 w-4" />
          Compose
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
  const queryClient = useQueryClient();
  const toast = useToast();

  const containersQuery = useQuery({ queryKey: ["containers"], queryFn: fetchContainers });

  const controlMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "start" | "stop" | "restart" }) =>
      controlContainer(id, action),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["containers"] });
      toast.success("Container " + variables.action + " successful");
    },
    onError: (_err, variables) => {
      toast.error("Failed to " + variables.action + " container");
    },
  });

  const containers = containersQuery.data?.data ?? [];
  const running = containers.filter((c) => c.state === "running").length;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {containersQuery.isLoading
          ? "Loading containers..."
          : running + " running / " + containers.length + " total"}
      </p>

      {containersQuery.isError && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">Failed to load containers.</p>
          </CardContent>
        </Card>
      )}

      {containers.length === 0 && !containersQuery.isLoading && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">No containers found.</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {containers.map((container) => (
          <ContainerRow
            key={container.id}
            container={container}
            onAction={(action) => controlMutation.mutate({ id: container.id, action })}
            onViewLogs={() => onViewLogs(container.id, container.name)}
            isPending={controlMutation.isPending}
          />
        ))}
      </div>
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
          <span className={"rounded-full px-2 py-0.5 text-xs " + (container.state === "running" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600")}>
            {container.state}
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
  const queryClient = useQueryClient();
  const toast = useToast();
  const [pullName, setPullName] = useState("");

  const imagesQuery = useQuery({ queryKey: ["images"], queryFn: fetchImages });

  const pullMutation = useMutation({
    mutationFn: () => pullImage(pullName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["images"] });
      toast.success("Image pulled successfully");
      setPullName("");
    },
    onError: () => toast.error("Failed to pull image"),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => removeImage(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["images"] });
      toast.success("Image removed");
    },
    onError: () => toast.error("Failed to remove image"),
  });

  const images = imagesQuery.data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="nginx:latest"
          value={pullName}
          onChange={(e) => setPullName(e.target.value)}
          className="max-w-sm"
        />
        <Button onClick={() => pullMutation.mutate()} disabled={!pullName || pullMutation.isPending}>
          <Download className="mr-2 h-4 w-4" /> Pull
        </Button>
      </div>

      {imagesQuery.isError && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">Failed to load images.</p>
          </CardContent>
        </Card>
      )}

      {images.length === 0 && !imagesQuery.isLoading && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">No images found.</p>
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
              <Button variant="ghost" size="sm" onClick={() => removeMutation.mutate(image.id)} disabled={removeMutation.isPending} className="h-8 w-8 p-0">
                <Trash2 className="h-4 w-4 text-red-600" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── Compose Tab ──

function ComposeTab({ onViewLogs, onEditFile }: { onViewLogs: (name: string) => void; onEditFile: (path: string, name: string) => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();

  const projectsQuery = useQuery({ queryKey: ["compose-projects"], queryFn: fetchComposeProjects });

  const controlMutation = useMutation({
    mutationFn: ({ name, action, filePath }: { name: string; action: "up" | "down" | "restart"; filePath?: string }) =>
      controlComposeProject(name, action, filePath),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["compose-projects"] });
      queryClient.invalidateQueries({ queryKey: ["compose-services"] });
      toast.success("Compose project " + variables.action + " successful");
    },
    onError: (_err, variables) => {
      toast.error("Failed to " + variables.action + " compose project");
    },
  });

  const projects = projectsQuery.data?.data ?? [];

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {projectsQuery.isLoading
          ? "Loading compose projects..."
          : projects.length + " project(s) found"}
      </p>

      {projectsQuery.isError && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">Failed to load compose projects. Is Docker running?</p>
          </CardContent>
        </Card>
      )}

      {projects.length === 0 && !projectsQuery.isLoading && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">No compose projects found.</p>
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
                toast.error("No config file path available for this project");
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
                {project.services} service(s) | {project.status}
                {project.configFile && (" | " + project.configFile)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={onEditFile} className="h-8 px-2 text-xs" title="Edit compose file">
              <FileCode className="mr-1 h-3 w-3" /> Edit
            </Button>
            {!isUp ? (
              <Button variant="ghost" size="sm" onClick={() => onAction("up")} disabled={isPending} className="h-8 px-2 text-xs">
                <Play className="mr-1 h-3 w-3 text-green-600" /> Up
              </Button>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={() => onAction("down")} disabled={isPending} className="h-8 px-2 text-xs">
                  <Square className="mr-1 h-3 w-3 text-red-600" /> Down
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onAction("restart")} disabled={isPending} className="h-8 px-2 text-xs">
                  <RotateCcw className="mr-1 h-3 w-3 text-blue-600" /> Restart
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
            {servicesQuery.isLoading && <p className="text-sm text-muted-foreground">Loading services...</p>}
            {servicesQuery.isError && <p className="text-sm text-destructive">Failed to load services.</p>}
            {services.length === 0 && !servicesQuery.isLoading && (
              <p className="text-sm text-muted-foreground">No services found.</p>
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

// ── Modals ──

function ContainerLogsModal({ id, name, onClose }: { id: string; name: string; onClose: () => void }) {
  const logsQuery = useQuery({
    queryKey: ["container-logs", id],
    queryFn: () => fetchContainerLogs(id, 200),
  });
  const logs = logsQuery.data?.data?.logs ?? "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <Card className="mx-4 max-h-[80vh] w-full max-w-3xl">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-lg">Logs: {name}</CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}><X className="h-4 w-4" /></Button>
        </CardHeader>
        <CardContent>
          {logsQuery.isLoading && <p className="text-sm text-muted-foreground">Loading logs...</p>}
          {logsQuery.isError && <p className="text-sm text-destructive">Failed to load logs.</p>}
          {logs && <pre className="max-h-[60vh] overflow-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-50">{logs}</pre>}
          {!logs && !logsQuery.isLoading && <p className="text-sm text-muted-foreground">No logs available.</p>}
        </CardContent>
      </Card>
    </div>
  );
}

function ComposeLogsModal({ name, onClose }: { name: string; onClose: () => void }) {
  const logsQuery = useQuery({
    queryKey: ["compose-logs", name],
    queryFn: () => fetchComposeLogs(name, 200),
  });
  const logs = logsQuery.data?.data?.logs ?? "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <Card className="mx-4 max-h-[80vh] w-full max-w-3xl">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-lg">Compose Logs: {name}</CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}><X className="h-4 w-4" /></Button>
        </CardHeader>
        <CardContent>
          {logsQuery.isLoading && <p className="text-sm text-muted-foreground">Loading logs...</p>}
          {logsQuery.isError && <p className="text-sm text-destructive">Failed to load logs.</p>}
          {logs && <pre className="max-h-[60vh] overflow-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-50">{logs}</pre>}
          {!logs && !logsQuery.isLoading && <p className="text-sm text-muted-foreground">No logs available.</p>}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Compose File Editor Modal ──

function FileEditorModal({ path, name, onClose }: { path: string; name: string; onClose: () => void }) {
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
      toast.success("File saved");
      setResult({ type: "success", message: "File saved successfully" });
    },
    onError: (err: Error) => {
      toast.error("Failed to save file");
      setResult({ type: "error", message: err.message || "Failed to save file" });
    },
  });

  const validateMutation = useMutation({
    mutationFn: async () => {
      await writeComposeFile(path, content);
      return validateComposeFile(path);
    },
    onSuccess: () => {
      setResult({ type: "success", message: "Validation passed!" });
      toast.success("Compose file is valid");
    },
    onError: (err: Error & { response?: { data?: { error?: string } } }) => {
      const msg = err?.response?.data?.error || err?.message || "Validation failed";
      setResult({ type: "error", message: msg });
      toast.error("Validation failed");
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
      setResult({ type: "success", message: "Deployment successful! Containers are starting..." });
      toast.success("Compose project deployed");
    },
    onError: (err: Error & { response?: { data?: { error?: string } } }) => {
      const msg = err?.response?.data?.error || err?.message || "Deployment failed";
      setResult({ type: "error", message: msg });
      toast.error("Deployment failed");
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <Card className="mx-4 flex max-h-[85vh] w-full max-w-4xl flex-col">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileCode className="h-5 w-5" />
              Edit: {name}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1 font-mono">{path}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}><X className="h-4 w-4" /></Button>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col gap-3 overflow-hidden">
          {fileQuery.isLoading && <p className="text-sm text-muted-foreground">Loading file...</p>}
          {fileQuery.isError && <p className="text-sm text-destructive">Failed to load file. Check the path exists.</p>}

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
                  {content.split("\n").length} lines
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => saveMutation.mutate()}
                    disabled={saveMutation.isPending}
                  >
                    <Save className="mr-1 h-3 w-3" />
                    {saveMutation.isPending ? "Saving..." : "Save"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => validateMutation.mutate()}
                    disabled={validateMutation.isPending}
                  >
                    <CheckCircle className="mr-1 h-3 w-3" />
                    {validateMutation.isPending ? "Validating..." : "Validate"}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => deployMutation.mutate()}
                    disabled={deployMutation.isPending}
                  >
                    <Rocket className="mr-1 h-3 w-3" />
                    {deployMutation.isPending ? "Deploying..." : "Save & Deploy"}
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


