import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchConfigs,
  createConfig,
  updateConfig,
  deleteConfig,
  toggleConfig,
  applyConfig,
  testConfig,
} from "@/features/logrotate/api";
import type { LogRotateConfig, CreateConfigRequest } from "@/features/logrotate/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/stores/toast";
import {
  Plus,
  Trash2,
  X,
  RefreshCw,
  Play,
  FlaskConical,
  ToggleLeft,
  ToggleRight,
  FileText,
  Settings2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

const defaultForm: CreateConfigRequest = {
  name: "",
  logPaths: "",
  frequency: "daily",
  rotateCount: 7,
  maxSize: "100M",
  compress: true,
  createMode: "0644",
  postRotate: "",
};

export default function LogRotatePage() {
  const t = useTranslation();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<CreateConfigRequest>({ ...defaultForm });
  const [testOutput, setTestOutput] = useState<{ id: number; output: string } | null>(null);

  const configsQuery = useQuery({ queryKey: ["logrotate-configs"], queryFn: fetchConfigs });

  const createMutation = useMutation({
    mutationFn: createConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["logrotate-configs"] });
      resetForm();
      toast.success(t("logrotate.configCreated"));
    },
    onError: (err: Error) => toast.error(err.message || t("logrotate.createFailed")),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: CreateConfigRequest }) => updateConfig(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["logrotate-configs"] });
      resetForm();
      toast.success(t("logrotate.configUpdated"));
    },
    onError: (err: Error) => toast.error(err.message || t("logrotate.updateFailed")),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["logrotate-configs"] });
      toast.success(t("logrotate.configDeleted"));
    },
    onError: (err: Error) => toast.error(err.message || t("logrotate.deleteFailed")),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) => toggleConfig(id, enabled),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["logrotate-configs"] }),
  });

  const applyMutation = useMutation({
    mutationFn: applyConfig,
    onSuccess: () => toast.success(t("logrotate.configApplied")),
    onError: (err: Error) => toast.error(err.message || t("logrotate.applyFailed")),
  });

  const testMutation = useMutation({
    mutationFn: testConfig,
    onSuccess: (data, variables) => {
      setTestOutput({ id: variables, output: data.data?.output ?? "" });
    },
    onError: (err: Error) => toast.error(err.message || t("logrotate.testFailed")),
  });

  const configs = configsQuery.data?.data ?? [];

  function resetForm() {
    setForm({ ...defaultForm });
    setShowForm(false);
    setEditingId(null);
  }

  function handleEdit(cfg: LogRotateConfig) {
    setForm({
      name: cfg.name,
      logPaths: cfg.logPaths,
      frequency: cfg.frequency,
      rotateCount: cfg.rotateCount,
      maxSize: cfg.maxSize,
      compress: cfg.compress,
      createMode: cfg.createMode,
      postRotate: cfg.postRotate,
    });
    setEditingId(cfg.id);
    setShowForm(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editingId !== null) {
      updateMutation.mutate({ id: editingId, data: form });
    } else {
      createMutation.mutate(form);
    }
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("logrotate.title")}</h1>
          <p className="text-muted-foreground">{t("logrotate.subtitle")}</p>
        </div>
        <Button onClick={() => { resetForm(); setShowForm(!showForm); }}>
          <Plus className="mr-2 h-4 w-4" />
          {t("logrotate.addConfig")}
        </Button>
      </div>

      {/* Create/Edit Form */}
      {showForm && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle>{editingId !== null ? t("logrotate.editConfig") : t("logrotate.newConfig")}</CardTitle>
            <Button variant="ghost" size="sm" onClick={resetForm}>
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t("logrotate.name")}</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder={t("logrotate.namePlaceholder")}
                    required
                    disabled={editingId !== null}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("logrotate.frequency")}</Label>
                  <select
                    value={form.frequency}
                    onChange={(e) => setForm({ ...form, frequency: e.target.value })}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="daily">{t("logrotate.daily")}</option>
                    <option value="weekly">{t("logrotate.weekly")}</option>
                    <option value="monthly">{t("logrotate.monthly")}</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t("logrotate.logPaths")}</Label>
                <textarea
                  value={form.logPaths}
                  onChange={(e) => setForm({ ...form, logPaths: e.target.value })}
                  placeholder={t("logrotate.logPathsPlaceholder")}
                  required
                  rows={2}
                  className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>{t("logrotate.rotateCount")}</Label>
                  <Input
                    type="number"
                    min={1}
                    max={999}
                    value={form.rotateCount}
                    onChange={(e) => setForm({ ...form, rotateCount: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("logrotate.maxSize")}</Label>
                  <Input
                    value={form.maxSize}
                    onChange={(e) => setForm({ ...form, maxSize: e.target.value })}
                    placeholder="100M"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("logrotate.createMode")}</Label>
                  <Input
                    value={form.createMode}
                    onChange={(e) => setForm({ ...form, createMode: e.target.value })}
                    placeholder="0644"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t("logrotate.postRotate")}</Label>
                <Input
                  value={form.postRotate}
                  onChange={(e) => setForm({ ...form, postRotate: e.target.value })}
                  placeholder={t("logrotate.postRotatePlaceholder")}
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="compress"
                  checked={form.compress}
                  onChange={(e) => setForm({ ...form, compress: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="compress" className="cursor-pointer">{t("logrotate.compress")}</Label>
              </div>

              <div className="flex items-center gap-3">
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {(createMutation.isPending || updateMutation.isPending)
                    ? t("common.loading")
                    : editingId !== null ? t("common.save") : t("logrotate.createConfig")}
                </Button>
                <Button variant="outline" type="button" onClick={resetForm}>{t("common.cancel")}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Config List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            {t("logrotate.configs")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {configsQuery.isLoading && <p className="text-sm text-muted-foreground">{t("common.loading")}</p>}
          {configs.length === 0 && !configsQuery.isLoading && (
            <p className="text-sm text-muted-foreground">{t("logrotate.noConfigs")}</p>
          )}
          <div className="space-y-3">
            {configs.map((cfg) => (
              <div key={cfg.id} className="rounded-xl border border-border bg-card">
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <RefreshCw className={"h-4 w-4 shrink-0 " + (cfg.enabled ? "text-blue-500" : "text-muted-foreground/40")} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{cfg.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {cfg.logPaths} &middot; {cfg.frequency} &middot; {t("logrotate.keep")} {cfg.rotateCount}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleMutation.mutate({ id: cfg.id, enabled: !cfg.enabled })}
                      className="h-8 w-8 p-0"
                      title={cfg.enabled ? t("common.disable") : t("common.enable")}
                    >
                      {cfg.enabled
                        ? <ToggleRight className="h-5 w-5 text-green-600" />
                        : <ToggleLeft className="h-5 w-5 text-muted-foreground" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => applyMutation.mutate(cfg.id)}
                      disabled={applyMutation.isPending}
                      className="h-8 w-8 p-0"
                      title={t("logrotate.apply")}
                    >
                      <Play className="h-4 w-4 text-blue-500" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => testMutation.mutate(cfg.id)}
                      disabled={testMutation.isPending}
                      className="h-8 w-8 p-0"
                      title={t("logrotate.test")}
                    >
                      <FlaskConical className="h-4 w-4 text-amber-500" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(cfg)}
                      className="h-8 w-8 p-0"
                      title={t("common.edit")}
                    >
                      <FileText className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteMutation.mutate(cfg.id)}
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      title={t("common.delete")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Expanded details */}
                <ConfigDetails cfg={cfg} />

                {/* Test output */}
                {testOutput?.id === cfg.id && (
                  <div className="mx-4 mb-3 rounded-lg bg-muted p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium">{t("logrotate.testOutput")}</span>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setTestOutput(null)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                    <pre className="text-xs whitespace-pre-wrap break-all max-h-60 overflow-auto font-mono">
                      {testOutput.output}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ConfigDetails({ cfg }: { cfg: LogRotateConfig }) {
  const t = useTranslation();
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-1 px-4 pb-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        {expanded ? t("logrotate.hideDetails") : t("logrotate.showDetails")}
      </button>
      {expanded && (
        <div className="px-4 pb-3 grid gap-2 text-xs sm:grid-cols-2">
          <div>
            <span className="text-muted-foreground">{t("logrotate.maxSize")}: </span>
            <span className="font-medium">{cfg.maxSize}</span>
          </div>
          <div>
            <span className="text-muted-foreground">{t("logrotate.compress")}: </span>
            <span className="font-medium">{cfg.compress ? t("common.yes") : t("common.na")}</span>
          </div>
          <div>
            <span className="text-muted-foreground">{t("logrotate.createMode")}: </span>
            <span className="font-medium">{cfg.createMode}</span>
          </div>
          {cfg.postRotate && (
            <div className="sm:col-span-2">
              <span className="text-muted-foreground">{t("logrotate.postRotate")}: </span>
              <span className="font-mono text-xs">{cfg.postRotate}</span>
            </div>
          )}
          <div>
            <span className="text-muted-foreground">{t("logrotate.status")}: </span>
            <span className={"font-medium " + (cfg.enabled ? "text-green-500" : "text-muted-foreground")}>
              {cfg.enabled ? t("common.enabled") : t("common.disabled")}
            </span>
          </div>
        </div>
      )}
    </>
  );
}
