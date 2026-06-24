import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchProxyRules, createProxyRule, updateProxyRule, deleteProxyRule,
  toggleProxyRule, fetchProxyStatus, reloadProxyConfig,
} from "@/features/proxy/api";
import type { ProxyRule } from "@/features/proxy/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/stores/toast";
import { useTranslation } from "@/hooks/useTranslation";
import {
  Network, Plus, Trash2, X, ToggleLeft, ToggleRight,
  Pencil, RefreshCw, Globe, Lock,
} from "lucide-react";

const emptyForm = { domain: "", target: "", protocol: "http" };

export default function ProxyPage() {
  const t = useTranslation();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...emptyForm });

  const rulesQuery = useQuery({ queryKey: ["proxy-rules"], queryFn: fetchProxyRules });
  const statusQuery = useQuery({ queryKey: ["proxy-status"], queryFn: fetchProxyStatus });

  const createMutation = useMutation({
    mutationFn: createProxyRule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proxy-rules"] });
      setShowForm(false);
      setForm({ ...emptyForm });
      toast.success(t("proxy.ruleCreated"));
    },
    onError: (err: Error) => toast.error(err.message || t("proxy.createFailed")),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: typeof emptyForm }) => updateProxyRule(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proxy-rules"] });
      setShowForm(false);
      setEditId(null);
      setForm({ ...emptyForm });
      toast.success(t("proxy.ruleUpdated"));
    },
    onError: (err: Error) => toast.error(err.message || t("proxy.updateFailed")),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteProxyRule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proxy-rules"] });
      toast.success(t("proxy.ruleDeleted"));
    },
    onError: (err: Error) => toast.error(err.message || t("proxy.deleteFailed")),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) => toggleProxyRule(id, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proxy-rules"] });
      toast.success(t("proxy.ruleToggled"));
    },
    onError: (err: Error) => toast.error(err.message || t("proxy.toggleFailed")),
  });

  const reloadMutation = useMutation({
    mutationFn: reloadProxyConfig,
    onSuccess: () => toast.success(t("proxy.reloaded")),
    onError: (err: Error) => toast.error(err.message || t("proxy.reloadFailed")),
  });

  const rules = rulesQuery.data?.data ?? [];
  const status = statusQuery.data?.data;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editId !== null) {
      updateMutation.mutate({ id: editId, data: form });
    } else {
      createMutation.mutate(form);
    }
  }

  function handleEdit(rule: ProxyRule) {
    setEditId(rule.id);
    setForm({ domain: rule.domain, target: rule.target, protocol: rule.protocol });
    setShowForm(true);
  }

  function handleDelete(id: number, domain: string) {
    if (confirm(t("proxy.deleteConfirm").replace("{domain}", domain))) {
      deleteMutation.mutate(id);
    }
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("proxy.title")}</h1>
          <p className="text-muted-foreground">{t("proxy.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => reloadMutation.mutate()} disabled={reloadMutation.isPending}>
            <RefreshCw className={"mr-2 h-4 w-4 " + (reloadMutation.isPending ? "animate-spin" : "")} />
            {t("proxy.reload")}
          </Button>
          <Button onClick={() => { setShowForm(!showForm); setEditId(null); setForm({ ...emptyForm }); }}>
            <Plus className="mr-2 h-4 w-4" />
            {t("proxy.addRule")}
          </Button>
        </div>
      </div>

      {status && (
        <Card>
          <CardContent className="flex items-center gap-3 py-3">
            <div className={"h-2.5 w-2.5 rounded-full " + (status.running ? "bg-green-400 shadow-sm shadow-green-400/50" : status.installed ? "bg-amber-400 shadow-sm shadow-amber-400/50" : "bg-slate-400 shadow-sm shadow-slate-400/50")} />
            <span className="text-sm font-medium">Caddy</span>
            <span className="text-xs text-muted-foreground">
              {status.installed ? (status.running ? t("proxy.running") : t("proxy.installedNotRunning")) : t("proxy.notInstalled")}
            </span>
            {status.version && <span className="ml-auto text-xs text-muted-foreground">{status.version.trim()}</span>}
          </CardContent>
        </Card>
      )}

      {showForm && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{editId !== null ? t("proxy.editRule") : t("proxy.newRule")}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <Label>{t("proxy.domain")}</Label>
                  <Input value={form.domain} onChange={(e) => setForm((p) => ({ ...p, domain: e.target.value }))} placeholder="app.example.com" required className="mt-1" />
                </div>
                <div>
                  <Label>{t("proxy.target")}</Label>
                  <Input value={form.target} onChange={(e) => setForm((p) => ({ ...p, target: e.target.value }))} placeholder="127.0.0.1:3000" required className="mt-1" />
                </div>
                <div>
                  <Label>{t("proxy.protocol")}</Label>
                  <select value={form.protocol} onChange={(e) => setForm((p) => ({ ...p, protocol: e.target.value }))} className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors">
                    <option value="http">HTTP</option>
                    <option value="https">HTTPS</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editId !== null ? t("proxy.updateRule") : t("proxy.createRule")}
                </Button>
                <Button variant="outline" type="button" onClick={() => { setShowForm(false); setEditId(null); }}>{t("common.cancel")}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {rulesQuery.isLoading && <p className="text-sm text-muted-foreground">{t("proxy.loading")}</p>}
      {rules.length === 0 && !rulesQuery.isLoading && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">{t("proxy.noRules")}</p>
            <p className="text-xs text-muted-foreground mt-1">{t("proxy.firstRule")}</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {rules.map((rule) => (
          <Card key={rule.id} className="border-border bg-card transition-all duration-200 hover:border-border/80">
            <CardContent className="flex items-center justify-between py-4">
              <div className="flex items-center gap-4">
                <div className={"flex h-10 w-10 items-center justify-center rounded-xl transition-all " + (rule.enabled ? "bg-indigo-500/10 text-indigo-400 shadow-sm shadow-indigo-500/10" : "bg-muted text-muted-foreground")}>
                  <Network className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                    <p className="font-medium truncate">{rule.domain}</p>
                    <span className="rounded-full border border-indigo-500/20 bg-indigo-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-indigo-400">
                      {rule.protocol.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                    {rule.protocol === "https" ? <Lock className="h-3 w-3" /> : <Globe className="h-3 w-3" />}
                    {t("proxy.target")}: {rule.target}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => toggleMutation.mutate({ id: rule.id, enabled: !rule.enabled })} className="h-8 w-8 p-0" title={rule.enabled ? t("common.disable") : t("common.enable")}>
                  {rule.enabled ? <ToggleRight className="h-5 w-5 text-green-600" /> : <ToggleLeft className="h-5 w-5 text-muted-foreground" />}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleEdit(rule)} className="h-8 w-8 p-0" title={t("common.edit")}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(rule.id, rule.domain)} className="h-8 w-8 p-0 text-destructive hover:text-destructive" title={t("common.delete")}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
