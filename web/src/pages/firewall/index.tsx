import { useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchFirewallRules, createFirewallRule, updateFirewallRule, deleteFirewallRule,
  toggleFirewallRule, reorderFirewallRules, batchToggleFirewallRules,
  batchDeleteFirewallRules, fetchFirewallStatus, applyFirewallRules,
  fetchPresetTemplates,
} from "@/features/firewall/api";
import type { FirewallRule, CreateRulePayload, PresetTemplate } from "@/features/firewall/api";
import { createRuleSchema, type CreateRuleFormData } from "@/features/firewall/schemas";
import { Button } from "@/components/ui/button";
import { useToast } from "@/stores/toast";
import { useTranslation } from "@/hooks/useTranslation";
import { Plus, RefreshCw, Zap } from "lucide-react";
import { FirewallStatusCard } from "@/features/firewall/components/FirewallStatusCard";
import { BatchActionsBar } from "@/features/firewall/components/BatchActionsBar";
import { PresetTemplatesPanel } from "@/features/firewall/components/PresetTemplatesPanel";
import { FirewallRuleForm } from "@/features/firewall/components/FirewallRuleForm";
import { FirewallRulesTable } from "@/features/firewall/components/FirewallRulesTable";

const emptyForm: CreateRuleFormData = {
  name: "", chain: "INPUT", protocol: "tcp", source: "", destination: "", port: "", action: "ACCEPT",
};

export default function FirewallPage() {
  const t = useTranslation();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [showForm, setShowForm] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const { register, handleSubmit: rhfHandleSubmit, formState: { errors }, reset } = useForm<CreateRuleFormData>({
    resolver: zodResolver(createRuleSchema),
    defaultValues: emptyForm,
  });
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
      reset(emptyForm);
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
      reset(emptyForm);
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

  const onSubmit = useCallback((data: CreateRuleFormData) => {
    if (editId !== null) {
      updateMutation.mutate({ id: editId, data });
    } else {
      createMutation.mutate(data);
    }
  }, [editId, createMutation, updateMutation]);

  const handleEdit = useCallback((rule: FirewallRule) => {
    setEditId(rule.id);
    reset({
      name: rule.name, chain: rule.chain, protocol: rule.protocol,
      source: rule.source, destination: rule.destination, port: rule.port, action: rule.action,
    });
    setShowForm(true);
    setShowPresets(false);
  }, [reset]);

  const handleDelete = useCallback((id: number, name: string) => {
    if (confirm(t("firewall.deleteConfirm").replace("{name}", name))) {
      deleteMutation.mutate(id);
    }
  }, [deleteMutation, t]);

  const handlePresetSelect = useCallback((preset: PresetTemplate) => {
    reset({
      name: preset.name, chain: preset.chain, protocol: preset.protocol,
      source: "", destination: "", port: preset.port, action: preset.action,
    });
    setEditId(null);
    setShowForm(true);
    setShowPresets(false);
  }, [reset]);

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
          <Button onClick={() => { setShowForm(!showForm); setShowPresets(false); setEditId(null); reset(emptyForm); }}>
            <Plus className="mr-2 h-4 w-4" />
            {t("firewall.addRule")}
          </Button>
        </div>
      </div>

      {/* Status Bar */}
      {status && <FirewallStatusCard status={status} />}

      {/* Batch Actions */}
      <BatchActionsBar
        selectedCount={selectedIds.size}
        onBatchEnable={() => batchToggleMutation.mutate({ ids: [...selectedIds], enabled: true })}
        onBatchDisable={() => batchToggleMutation.mutate({ ids: [...selectedIds], enabled: false })}
        onBatchDelete={() => { if (confirm(t("firewall.batchDeleteConfirm"))) batchDeleteMutation.mutate([...selectedIds]); }}
        onClearSelection={() => setSelectedIds(new Set())}
        isPending={batchToggleMutation.isPending || batchDeleteMutation.isPending}
      />

      {/* Preset Templates */}
      {showPresets && (
        <PresetTemplatesPanel
          presets={presets}
          onSelect={handlePresetSelect}
          onClose={() => setShowPresets(false)}
        />
      )}

      {/* Add/Edit Rule Form */}
      {showForm && (
        <FirewallRuleForm
          editId={editId}
          register={register}
          errors={errors}
          onSubmit={rhfHandleSubmit(onSubmit)}
          onClose={() => { setShowForm(false); setEditId(null); }}
          isPending={createMutation.isPending || updateMutation.isPending}
        />
      )}

      {/* Rules Table */}
      {rulesQuery.isLoading && <p className="text-sm text-muted-foreground">{t("common.loading")}</p>}

      <FirewallRulesTable
        rules={rules}
        selectedIds={selectedIds}
        allSelected={allSelected}
        onToggleSelect={toggleSelect}
        onToggleSelectAll={toggleSelectAll}
        onToggle={(id, enabled) => toggleMutation.mutate({ id, enabled })}
        onMove={moveRule}
        onEdit={handleEdit}
        onDelete={handleDelete}
        isToggling={toggleMutation.isPending}
      />
    </div>
  );
}
