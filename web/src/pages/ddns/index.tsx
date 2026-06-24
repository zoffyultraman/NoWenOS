import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchDDNSConfigs, createDDNSConfig, updateDDNSConfig, deleteDDNSConfig,
  toggleDDNSConfig, manualUpdateDDNS, fetchDDNSStatus, fetchDDNSUpdateLog,
} from "@/features/ddns/api";
import type { DDNSConfig, DDNSUpdateLog } from "@/features/ddns/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/stores/toast";
import { useTranslation } from "@/hooks/useTranslation";
import {
  Globe, Plus, Trash2, ToggleLeft, ToggleRight,
  Pencil, RefreshCw, Zap, Clock, ChevronDown, ChevronUp,
  CheckCircle, XCircle, AlertCircle,
} from "lucide-react";

const PROVIDERS = [
  { value: "cloudflare", label: "Cloudflare" },
  { value: "dyndns", label: "DynDNS" },
  { value: "noip", label: "No-IP" },
  { value: "duckdns", label: "DuckDNS" },
  { value: "custom", label: "Custom Script", labelKey: "ddns.customScript" },
];

const emptyForm = {
  provider: "cloudflare",
  domain: "",
  username: "",
  password: "",
  enabled: true,
};

export default function DDNSPage() {
  const t = useTranslation();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [expandedLog, setExpandedLog] = useState<number | null>(null);

  const configsQuery = useQuery({ queryKey: ["ddns-configs"], queryFn: fetchDDNSConfigs });
  const statusQuery = useQuery({ queryKey: ["ddns-status"], queryFn: fetchDDNSStatus });

  const createMutation = useMutation({
    mutationFn: createDDNSConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ddns-configs"] });
      queryClient.invalidateQueries({ queryKey: ["ddns-status"] });
      setShowForm(false);
      setForm({ ...emptyForm });
      toast.success(t("ddns.configCreated"));
    },
    onError: (err: Error) => toast.error(err.message || t("ddns.createFailed")),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: typeof emptyForm }) => updateDDNSConfig(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ddns-configs"] });
      queryClient.invalidateQueries({ queryKey: ["ddns-status"] });
      setShowForm(false);
      setEditId(null);
      setForm({ ...emptyForm });
      toast.success(t("ddns.configUpdated"));
    },
    onError: (err: Error) => toast.error(err.message || t("ddns.updateFailed")),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteDDNSConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ddns-configs"] });
      queryClient.invalidateQueries({ queryKey: ["ddns-status"] });
      toast.success(t("ddns.configDeleted"));
    },
    onError: (err: Error) => toast.error(err.message || t("ddns.deleteFailed")),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) => toggleDDNSConfig(id, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ddns-configs"] });
      queryClient.invalidateQueries({ queryKey: ["ddns-status"] });
      toast.success(t("ddns.configToggled"));
    },
    onError: (err: Error) => toast.error(err.message || t("ddns.toggleFailed")),
  });

  const manualUpdateMutation = useMutation({
    mutationFn: manualUpdateDDNS,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ddns-configs"] });
      queryClient.invalidateQueries({ queryKey: ["ddns-status"] });
      toast.success(t("ddns.updateSuccess"));
    },
    onError: (err: Error) => toast.error(err.message || t("ddns.updateFailedManual")),
  });

  const configs = configsQuery.data?.data ?? [];
  const status = statusQuery.data?.data;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editId !== null) {
      updateMutation.mutate({ id: editId, data: form });
    } else {
      createMutation.mutate(form);
    }
  }

  function handleEdit(config: DDNSConfig) {
    setEditId(config.id);
    setForm({
      provider: config.provider,
      domain: config.domain,
      username: config.username,
      password: config.password,
      enabled: config.enabled,
    });
    setShowForm(true);
  }

  function handleDelete(id: number, domain: string) {
    if (confirm(t("ddns.deleteConfirm").replace("{domain}", domain))) {
      deleteMutation.mutate(id);
    }
  }

  function getProviderLabel(provider: string): string {
    const found = PROVIDERS.find((p) => p.value === provider);
    if (!found) return provider;
    return found.labelKey ? t(found.labelKey) : found.label;
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("ddns.title")}</h1>
          <p className="text-muted-foreground">{t("ddns.subtitle")}</p>
        </div>
        <Button onClick={() => { setShowForm(!showForm); setEditId(null); setForm({ ...emptyForm }); }}>
          <Plus className="mr-2 h-4 w-4" />
          {t("ddns.addConfig")}
        </Button>
      </div>

      {/* Status Bar */}
      {status && (
        <Card>
          <CardContent className="flex items-center gap-4 py-3 flex-wrap">
            <div className="flex items-center gap-2">
              <div className={"h-2.5 w-2.5 rounded-full " + (status.enabledConfigs > 0 ? "bg-green-400 shadow-sm shadow-green-400/50" : "bg-muted-foreground shadow-sm shadow-muted-foreground/50")} />
              <span className="text-sm font-medium">{t("ddns.statusTitle")}</span>
            </div>
            <span className="text-xs text-muted-foreground">
              {t("ddns.totalConfigs")}: {status.totalConfigs}
            </span>
            <span className="text-xs text-muted-foreground">
              {t("ddns.enabledConfigs")}: {status.enabledConfigs}
            </span>
            {status.currentIP && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Globe className="h-3 w-3" />
                {t("ddns.currentIP")}: {status.currentIP}
              </span>
            )}
            {status.lastUpdate && (
              <span className="text-xs text-muted-foreground flex items-center gap-1 ml-auto">
                <Clock className="h-3 w-3" />
                {t("ddns.lastUpdate")}: {status.lastUpdate}
              </span>
            )}
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Form */}
      {showForm && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{editId !== null ? t("ddns.editConfig") : t("ddns.newConfig")}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>{t("ddns.provider")}</Label>
                  <select
                    value={form.provider}
                    onChange={(e) => setForm((p) => ({ ...p, provider: e.target.value }))}
                    className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors"
                  >
                    {PROVIDERS.map((p) => (
                      <option key={p.value} value={p.value}>{p.labelKey ? t(p.labelKey) : p.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>{t("ddns.domain")}</Label>
                  <Input
                    value={form.domain}
                    onChange={(e) => setForm((p) => ({ ...p, domain: e.target.value }))}
                    placeholder={form.provider === "duckdns" ? "subdomain" : "subdomain.example.com"}
                    required
                    className="mt-1"
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>{form.provider === "cloudflare" ? t("ddns.apiToken") : form.provider === "custom" ? t("ddns.script") : t("ddns.username")}</Label>
                  <Input
                    value={form.username}
                    onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
                    placeholder={
                      form.provider === "cloudflare" ? "API Token" :
                      form.provider === "custom" ? "/path/to/script.sh {domain} {ip}" :
                      form.provider === "duckdns" ? t("ddns.optional") :
                      "username"
                    }
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>{form.provider === "cloudflare" ? t("ddns.zoneId") : form.provider === "duckdns" ? t("ddns.token") : t("ddns.password")}</Label>
                  <Input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                    placeholder={
                      form.provider === "duckdns" ? "token" :
                      form.provider === "cloudflare" ? t("ddns.optional") :
                      "password"
                    }
                    className="mt-1"
                  />
                </div>
              </div>
              {form.provider === "custom" && (
                <p className="text-xs text-muted-foreground">
                  {t("ddns.customHint")}
                </p>
              )}
              <div className="flex items-center gap-3">
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editId !== null ? t("ddns.updateConfig") : t("ddns.createConfig")}
                </Button>
                <Button variant="outline" type="button" onClick={() => { setShowForm(false); setEditId(null); }}>
                  {t("common.cancel")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Loading / Empty State */}
      {configsQuery.isLoading && <p className="text-sm text-muted-foreground">{t("ddns.loading")}</p>}
      {configs.length === 0 && !configsQuery.isLoading && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">{t("ddns.noConfigs")}</p>
            <p className="text-xs text-muted-foreground mt-1">{t("ddns.firstConfig")}</p>
          </CardContent>
        </Card>
      )}

      {/* Config List */}
      <div className="space-y-3">
        {configs.map((config) => (
          <DDNSConfigCard
            key={config.id}
            config={config}
            expanded={expandedLog === config.id}
            onToggleExpand={() => setExpandedLog(expandedLog === config.id ? null : config.id)}
            onEdit={() => handleEdit(config)}
            onDelete={() => handleDelete(config.id, config.domain)}
            onToggle={() => toggleMutation.mutate({ id: config.id, enabled: !config.enabled })}
            onManualUpdate={() => manualUpdateMutation.mutate(config.id)}
            isUpdating={manualUpdateMutation.isPending}
            getProviderLabel={getProviderLabel}
            t={t}
          />
        ))}
      </div>
    </div>
  );
}

function DDNSConfigCard({
  config, expanded, onToggleExpand, onEdit, onDelete, onToggle, onManualUpdate,
  isUpdating, getProviderLabel, t,
}: {
  config: DDNSConfig;
  expanded: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
  onManualUpdate: () => void;
  isUpdating: boolean;
  getProviderLabel: (p: string) => string;
  t: (key: string) => string;
}) {
  const logQuery = useQuery({
    queryKey: ["ddns-log", config.id],
    queryFn: () => fetchDDNSUpdateLog(config.id, 10),
    enabled: expanded,
  });

  const logs = logQuery.data?.data ?? [];

  return (
    <Card className="border-border bg-card transition-all duration-200 hover:border-border/80">
      <CardContent className="py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={"flex h-10 w-10 items-center justify-center rounded-xl transition-all " + (config.enabled ? "bg-cyan-500/10 text-cyan-400 shadow-sm shadow-cyan-500/10" : "bg-muted text-muted-foreground")}>
              <Globe className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium truncate">{config.domain}</p>
                <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-cyan-400">
                  {getProviderLabel(config.provider)}
                </span>
                <StatusBadge enabled={config.enabled} ip={config.ip} />
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                {config.ip && (
                  <span className="flex items-center gap-1">
                    <Zap className="h-3 w-3" />
                    IP: {config.ip}
                  </span>
                )}
                {config.updatedAt && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {config.updatedAt}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost" size="sm"
              onClick={onManualUpdate}
              disabled={isUpdating}
              className="h-8 w-8 p-0"
              title={t("ddns.manualUpdate")}
            >
              <RefreshCw className={"h-4 w-4 " + (isUpdating ? "animate-spin" : "")} />
            </Button>
            <Button
              variant="ghost" size="sm"
              onClick={onToggleExpand}
              className="h-8 w-8 p-0"
              title={t("ddns.updateHistory")}
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost" size="sm"
              onClick={onToggle}
              className="h-8 w-8 p-0"
              title={config.enabled ? t("common.disable") : t("common.enable")}
            >
              {config.enabled ? <ToggleRight className="h-5 w-5 text-green-600" /> : <ToggleLeft className="h-5 w-5 text-muted-foreground" />}
            </Button>
            <Button variant="ghost" size="sm" onClick={onEdit} className="h-8 w-8 p-0" title={t("common.edit")}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={onDelete} className="h-8 w-8 p-0 text-destructive hover:text-destructive" title={t("common.delete")}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Update History */}
        {expanded && (
          <div className="mt-4 border-t pt-3">
            <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {t("ddns.updateHistory")}
            </h4>
            {logQuery.isLoading && <p className="text-xs text-muted-foreground">{t("ddns.loadingLog")}</p>}
            {logs.length === 0 && !logQuery.isLoading && (
              <p className="text-xs text-muted-foreground">{t("ddns.noLogEntries")}</p>
            )}
            {logs.length > 0 && (
              <div className="space-y-1.5">
                {logs.map((log) => (
                  <div key={log.id} className="flex items-center gap-2 text-xs">
                    {log.status === "success" ? (
                      <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                    )}
                    <span className="text-muted-foreground">{log.createdAt}</span>
                    <span>{log.oldIp || "-"} &rarr; {log.newIp}</span>
                    {log.message && <span className="text-muted-foreground">({log.message})</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ enabled, ip }: { enabled: boolean; ip: string }) {
  const t = useTranslation();
  if (!enabled) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
        <AlertCircle className="h-3 w-3" />
        {t("ddns.statusDisabled")}
      </span>
    );
  }
  if (!ip) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400">
        <AlertCircle className="h-3 w-3" />
        {t("ddns.statusPending")}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-medium text-green-400">
      <CheckCircle className="h-3 w-3" />
      {t("ddns.statusActive")}
    </span>
  );
}
