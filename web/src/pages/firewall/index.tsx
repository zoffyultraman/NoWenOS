import { useState, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchFirewallRules, createFirewallRule, updateFirewallRule, deleteFirewallRule,
  toggleFirewallRule, reorderFirewallRules, batchToggleFirewallRules,
  batchDeleteFirewallRules, fetchFirewallStatus, applyFirewallRules,
  fetchPresetTemplates,
} from "@/features/firewall/api";
import type { FirewallRule, CreateRulePayload, PresetTemplate } from "@/features/firewall/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/stores/toast";
import { useTranslation } from "@/hooks/useTranslation";
import {
  Shield, Plus, Trash2, X, ToggleLeft, ToggleRight,
  Pencil, RefreshCw, ChevronUp, ChevronDown, CheckSquare,
  Square, Zap,
} from "lucide-react";

const emptyForm: CreateRulePayload = {
  name: "", chain: "INPUT", protocol: "tcp", source: "", destination: "", port: "", action: "ACCEPT",
};

export default function FirewallPage() {
  const t = useTranslation();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [showForm, setShowForm] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<CreateRulePayload>({ ...emptyForm });
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const rulesQuery = useQuery({ queryKey: ["firewall-rules"], queryFn: fetchFirewallRules });
  const statusQuery = useQuery({ queryKey: ["firewall-status"], queryFn: fetchFirewallStatus });
  const presetsQuery = useQuery({ queryKey: ["firewall-presets"], queryFn: fetchPresetTemplates, enabled: showPresets });

  const createMutation = useMutation({
    mutationFn: createFirewallRule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["firewall-rules"] });
      queryClient.invalidateQueries({ queryKey: ["firewall-status"] });
      setShowForm(false);
      setForm({ ...emptyForm });
      toast.success(t("firewall.ruleCreated"));
    },
    onError: (err: Error) => toast.error(err.message || t("firewall.createFailed")),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: CreateRulePayload }) => updateFirewallRule(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["firewall-rules"] });
      setShowForm(false);
      setEditId(null);
      setForm({ ...emptyForm });
      toast.success(t("firewall.ruleUpdated"));
    },
    onError: (err: Error) => toast.error(err.message || t("firewall.updateFailed")),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteFirewallRule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["firewall-rules"] });
      queryClient.invalidateQueries({ queryKey: ["firewall-status"] });
      toast.success(t("firewall.ruleDeleted"));
    },
    onError: (err: Error) => toast.error(err.message || t("firewall.deleteFailed")),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) => toggleFirewallRule(id, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["firewall-rules"] });
      queryClient.invalidateQueries({ queryKey: ["firewall-status"] });
      toast.success(t("firewall.ruleToggled"));
    },
    onError: (err: Error) => toast.error(err.message || t("firewall.toggleFailed")),
  });

  const reorderMutation = useMutation({
    mutationFn: reorderFirewallRules,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["firewall-rules"] });
    },
    onError: (err: Error) => toast.error(err.message || t("firewall.reorderFailed")),
  });

  const batchToggleMutation = useMutation({
    mutationFn: ({ ids, enabled }: { ids: number[]; enabled: boolean }) => batchToggleFirewallRules(ids, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["firewall-rules"] });
      queryClient.invalidateQueries({ queryKey: ["firewall-status"] });
      setSelectedIds(new Set());
      toast.success(t("firewall.batchToggled"));
    },
    onError: (err: Error) => toast.error(err.message || t("firewall.batchToggleFailed")),
  });

  const batchDeleteMutation = useMutation({
    mutationFn: batchDeleteFirewallRules,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["firewall-rules"] });
      queryClient.invalidateQueries({ queryKey: ["firewall-status"] });
      setSelectedIds(new Set());
      toast.success(t("firewall.batchDeleted"));
    },
    onError: (err: Error) => toast.error(err.message || t("firewall.batchDeleteFailed")),
  });

  const applyMutation = useMutation({
    mutationFn: () => applyFirewallRules(),
    onSuccess: () => toast.success(t("firewall.rulesApplied")),
    onError: (err: Error) => toast.error(err.message || t("firewall.applyFailed")),
  });

  const rules = rulesQuery.data?.data ?? [];
  const status = statusQuery.data?.data;
  const presets = presetsQuery.data?.data ?? [];

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (editId !== null) {
      updateMutation.mutate({ id: editId, data: form });
    } else {
      createMutation.mutate(form);
    }
  }, [editId, form, createMutation, updateMutation]);

  const handleEdit = useCallback((rule: FirewallRule) => {
    setEditId(rule.id);
    setForm({
      name: rule.name, chain: rule.chain, protocol: rule.protocol,
      source: rule.source, destination: rule.destination, port: rule.port, action: rule.action,
    });
    setShowForm(true);
    setShowPresets(false);
  }, []);

  const handleDelete = useCallback((id: number, name: string) => {
    if (confirm(t("firewall.deleteConfirm").replace("{name}", name))) {
      deleteMutation.mutate(id);
    }
  }, [deleteMutation, t]);

  const handlePresetSelect = useCallback((preset: PresetTemplate) => {
    setForm({
      name: preset.name, chain: preset.chain, protocol: preset.protocol,
      source: "", destination: "", port: preset.port, action: preset.action,
    });
    setEditId(null);
    setShowForm(true);
    setShowPresets(false);
  }, []);

  const moveRule = useCallback((index: number, direction: -1 | 1) => {
    const newRules = [...rules];
    const target = index + direction;
    if (target < 0 || target >= newRules.length) return;
    [newRules[index], newRules[target]] = [newRules[target], newRules[index]];
    reorderMutation.mutate(newRules.map((r) => r.id));
  }, [rules, reorderMutation]);

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === rules.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(rules.map((r) => r.id)));
    }
  }, [selectedIds, rules]);

  const allSelected = rules.length > 0 && selectedIds.size === rules.length;

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("firewall.title")}</h1>
          <p className="text-muted-foreground">{t("firewall.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => applyMutation.mutate()} disabled={applyMutation.isPending}>
            <RefreshCw className={"mr-2 h-4 w-4 " + (applyMutation.isPending ? "animate-spin" : "")} />
            {t("firewall.apply")}
          </Button>
          <Button variant="outline" onClick={() => { setShowPresets(!showPresets); setShowForm(false); }}>
            <Zap className="mr-2 h-4 w-4" />
            {t("firewall.presets")}
          </Button>
          <Button onClick={() => { setShowForm(!showForm); setShowPresets(false); setEditId(null); setForm({ ...emptyForm }); }}>
            <Plus className="mr-2 h-4 w-4" />
            {t("firewall.addRule")}
          </Button>
        </div>
      </div>

      {/* Status Bar */}
      {status && (
        <Card>
          <CardContent className="flex items-center gap-3 py-3">
            <div className={"h-2.5 w-2.5 rounded-full " + (status.running ? "bg-green-400 shadow-sm shadow-green-400/50" : status.installed ? "bg-amber-400 shadow-sm shadow-amber-400/50" : "bg-slate-400 shadow-sm shadow-slate-400/50")} />
            <span className="text-sm font-medium">{t("firewall.backend")}: {status.backend === "none" ? t("firewall.noBackend") : status.backend}</span>
            <span className="text-xs text-muted-foreground">
              {status.installed ? (status.running ? t("firewall.running") : t("firewall.installedNotRunning")) : t("firewall.notInstalled")}
            </span>
            {status.version && <span className="text-xs text-muted-foreground">{status.version.trim()}</span>}
            <span className="ml-auto text-xs text-muted-foreground">
              {t("firewall.activeRules")}: {status.ruleCount}
            </span>
          </CardContent>
        </Card>
      )}

      {/* Batch Actions */}
      {selectedIds.size > 0 && (
        <Card className="border-primary/30">
          <CardContent className="flex items-center gap-3 py-2">
            <span className="text-sm text-muted-foreground">
              {t("firewall.selected").replace("{count}", String(selectedIds.size))}
            </span>
            <Button variant="outline" size="sm" onClick={() => batchToggleMutation.mutate({ ids: [...selectedIds], enabled: true })} disabled={batchToggleMutation.isPending}>
              <ToggleRight className="mr-1.5 h-3.5 w-3.5" />
              {t("firewall.batchEnable")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => batchToggleMutation.mutate({ ids: [...selectedIds], enabled: false })} disabled={batchToggleMutation.isPending}>
              <ToggleLeft className="mr-1.5 h-3.5 w-3.5" />
              {t("firewall.batchDisable")}
            </Button>
            <Button variant="destructive" size="sm" onClick={() => { if (confirm(t("firewall.batchDeleteConfirm"))) batchDeleteMutation.mutate([...selectedIds]); }} disabled={batchDeleteMutation.isPending}>
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              {t("firewall.batchDelete")}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())} className="ml-auto">
              <X className="h-3.5 w-3.5" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Preset Templates */}
      {showPresets && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{t("firewall.presetTemplates")}</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setShowPresets(false)} className="h-7 w-7 p-0">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {presets.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => handlePresetSelect(preset)}
                  className="flex items-start gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:bg-accent"
                >
                  <Shield className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div>
                    <p className="text-sm font-medium">{preset.name}</p>
                    <p className="text-xs text-muted-foreground">{preset.description}</p>
                    <div className="mt-1 flex items-center gap-1.5">
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase">{preset.protocol}</span>
                      {preset.port && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium">{preset.port}</span>}
                      <span className="rounded bg-green-500/10 px-1.5 py-0.5 text-[10px] font-medium text-green-500">{preset.action}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Rule Form */}
      {showForm && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{editId !== null ? t("firewall.editRule") : t("firewall.newRule")}</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => { setShowForm(false); setEditId(null); }} className="h-7 w-7 p-0">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="sm:col-span-2">
                  <Label>{t("firewall.form.name")}</Label>
                  <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder={t("firewall.form.namePlaceholder")} required className="mt-1" />
                </div>
                <div>
                  <Label>{t("firewall.form.chain")}</Label>
                  <select value={form.chain} onChange={(e) => setForm((p) => ({ ...p, chain: e.target.value }))} className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors">
                    <option value="INPUT">INPUT</option>
                    <option value="OUTPUT">OUTPUT</option>
                    <option value="FORWARD">FORWARD</option>
                  </select>
                </div>
                <div>
                  <Label>{t("firewall.form.protocol")}</Label>
                  <select value={form.protocol} onChange={(e) => setForm((p) => ({ ...p, protocol: e.target.value }))} className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors">
                    <option value="tcp">TCP</option>
                    <option value="udp">UDP</option>
                    <option value="icmp">ICMP</option>
                    <option value="any">Any</option>
                  </select>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <Label>{t("firewall.form.source")}</Label>
                  <Input value={form.source} onChange={(e) => setForm((p) => ({ ...p, source: e.target.value }))} placeholder="0.0.0.0/0" className="mt-1" />
                </div>
                <div>
                  <Label>{t("firewall.form.destination")}</Label>
                  <Input value={form.destination} onChange={(e) => setForm((p) => ({ ...p, destination: e.target.value }))} placeholder="0.0.0.0/0" className="mt-1" />
                </div>
                <div>
                  <Label>{t("firewall.form.port")}</Label>
                  <Input value={form.port} onChange={(e) => setForm((p) => ({ ...p, port: e.target.value }))} placeholder="80, 443, 8000:8100" className="mt-1" />
                </div>
                <div>
                  <Label>{t("firewall.form.action")}</Label>
                  <select value={form.action} onChange={(e) => setForm((p) => ({ ...p, action: e.target.value }))} className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors">
                    <option value="ACCEPT">ACCEPT</option>
                    <option value="DROP">DROP</option>
                    <option value="REJECT">REJECT</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editId !== null ? t("firewall.form.update") : t("firewall.form.create")}
                </Button>
                <Button variant="outline" type="button" onClick={() => { setShowForm(false); setEditId(null); }}>
                  {t("common.cancel")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Rules Table */}
      {rulesQuery.isLoading && <p className="text-sm text-muted-foreground">{t("common.loading")}</p>}

      {rules.length === 0 && !rulesQuery.isLoading && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Shield className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">{t("firewall.noRules")}</p>
            <p className="text-xs text-muted-foreground mt-1">{t("firewall.firstRule")}</p>
          </CardContent>
        </Card>
      )}

      {rules.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="w-10 px-4 py-3 text-left">
                      <button onClick={toggleSelectAll} className="text-muted-foreground hover:text-foreground">
                        {allSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("firewall.table.name")}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("firewall.table.chain")}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("firewall.table.protocol")}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("firewall.table.source")}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("firewall.table.destination")}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("firewall.table.port")}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("firewall.table.action")}</th>
                    <th className="px-4 py-3 text-center font-medium text-muted-foreground">{t("firewall.table.status")}</th>
                    <th className="w-32 px-4 py-3 text-right font-medium text-muted-foreground">{t("firewall.table.actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map((rule, index) => (
                    <tr key={rule.id} className={"border-b border-border/50 transition-colors hover:bg-muted/30 " + (selectedIds.has(rule.id) ? "bg-primary/5" : "")}>
                      <td className="px-4 py-3">
                        <button onClick={() => toggleSelect(rule.id)} className="text-muted-foreground hover:text-foreground">
                          {selectedIds.has(rule.id) ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4" />}
                        </button>
                      </td>
                      <td className="px-4 py-3 font-medium">{rule.name || "-"}</td>
                      <td className="px-4 py-3">
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase">{rule.chain}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium uppercase text-blue-500">{rule.protocol}</span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{rule.source || "*"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{rule.destination || "*"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{rule.port || "*"}</td>
                      <td className="px-4 py-3">
                        <span className={"rounded px-1.5 py-0.5 text-[10px] font-medium uppercase " + (rule.action === "ACCEPT" ? "bg-green-500/10 text-green-500" : rule.action === "DROP" ? "bg-red-500/10 text-red-500" : "bg-amber-500/10 text-amber-500")}>
                          {rule.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => toggleMutation.mutate({ id: rule.id, enabled: !rule.enabled })}
                          className="inline-flex"
                          title={rule.enabled ? t("common.disable") : t("common.enable")}
                        >
                          {rule.enabled ? <ToggleRight className="h-5 w-5 text-green-500" /> : <ToggleLeft className="h-5 w-5 text-slate-400" />}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => moveRule(index, -1)} disabled={index === 0} className="h-7 w-7 p-0" title={t("firewall.moveUp")}>
                            <ChevronUp className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => moveRule(index, 1)} disabled={index === rules.length - 1} className="h-7 w-7 p-0" title={t("firewall.moveDown")}>
                            <ChevronDown className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(rule)} className="h-7 w-7 p-0" title={t("common.edit")}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(rule.id, rule.name)} className="h-7 w-7 p-0 text-destructive hover:text-destructive" title={t("common.delete")}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
