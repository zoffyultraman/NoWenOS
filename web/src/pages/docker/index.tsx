import { useState } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from "@/components/ui/button";
import { Container, HardDrive, Layers } from "lucide-react";
import { ContainersTab } from "@/features/docker/components/ContainersTab";
import { ImagesTab } from "@/features/docker/components/ImagesTab";
import { ComposeTab } from "@/features/docker/components/ComposeTab";
import { ContainerLogsModal } from "@/features/docker/components/ContainerLogsModal";
import { ComposeLogsModal } from "@/features/docker/components/ComposeLogsModal";
import { FileEditorModal } from "@/features/docker/components/FileEditorModal";

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

      <div className="flex flex-wrap gap-2">
        <Button
          variant={activeTab === "containers" ? "default" : "outline"}
          onClick={() => setActiveTab("containers")}
          size="sm"
        >
          <Container className="mr-2 h-4 w-4" />
          {t("docker.containers")}
        </Button>
        <Button
          variant={activeTab === "images" ? "default" : "outline"}
          onClick={() => setActiveTab("images")}
          size="sm"
        >
          <HardDrive className="mr-2 h-4 w-4" />
          {t("docker.images")}
        </Button>
        <Button
          variant={activeTab === "compose" ? "default" : "outline"}
          onClick={() => setActiveTab("compose")}
          size="sm"
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
