import { useState } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { readComposeFile, writeComposeFile, validateComposeFile, deployComposeFile } from "@/features/docker/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/stores/toast";
import { FileCode, Save, CheckCircle, Rocket, X } from "lucide-react";

interface FileEditorModalProps {
  path: string;
  name: string;
  onClose: () => void;
}

export function FileEditorModal({ path, name, onClose }: FileEditorModalProps) {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 sm:p-4">
      <Card className="flex max-h-[85vh] w-full max-w-4xl flex-col">
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
                  <Button variant="outline" size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                    <Save className="mr-1 h-3 w-3" />
                    {saveMutation.isPending ? t("docker.saving") : t("docker.save")}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => validateMutation.mutate()} disabled={validateMutation.isPending}>
                    <CheckCircle className="mr-1 h-3 w-3" />
                    {validateMutation.isPending ? t("docker.validating") : t("docker.validate")}
                  </Button>
                  <Button size="sm" onClick={() => deployMutation.mutate()} disabled={deployMutation.isPending}>
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
