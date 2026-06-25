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
import { useToast } from "@/stores/toast";
import { useTranslation } from "@/hooks/useTranslation";

const defaultValues: CreateRuleFormData = {
  name: "", chain: "INPUT", protocol: "tcp", source: "", destination: "", port: "", action: "ACCEPT",
};

export function useFirewallPage() {
  const t = useTranslation();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [showForm, setShowForm] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const form = useForm<CreateRuleFormData>({
    resolver: zodResolver(createRuleSchema),
    defaultValues: { ...defaultValues },
  });

  const rulesQuery = useQuery({ queryKey: ["firewall-rules"], queryFn: fetchFirewallRules });
  const statusQuery = useQuery({ queryKey: ["firewall-status"], queryFn: fetchFirewallStatus });
  const presetsQuery = useQuery({ queryKey: ["firewall-presets"], queryFn: fetchPresetTemplates, enabled: showPresets });

  const createMutation = useMutation({
    mutationFn: createFirewallRule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["firewall-rules"] });
      queryClient.invalidateQueries({ queryKey: ["firewall-status"] });
      setShowForm(false);
      form.reset({ ...defaultValues });
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
      form.reset({ ...defaultValues });
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
    const data = form.getValues();
    if (editId !== null) {
      updateMutation.mutate({ id: editId, data });
    } else {
      createMutation.mutate(data);
    }
  }, [editId, form, createMutation, updateMutation]);

  const handleEdit = useCallback((rule: FirewallRule) => {
    setEditId(rule.id);
    form.reset({
      name: rule.name, chain: rule.chain as CreateRuleFormData["chain"],
      protocol: rule.protocol as CreateRuleFormData["protocol"],
      source: rule.source, destination: rule.destination, port: rule.port,
      action: rule.action as CreateRuleFormData["action"],
    });
    setShowForm(true);
    setShowPresets(false);
  }, [form]);

  const handleDelete = useCallback((id: number, name: string) => {
    if (confirm(t("firewall.deleteConfirm").replace("{name}", name))) {
      deleteMutation.mutate(id);
    }
  }, [deleteMutation, t]);

  const handlePresetSelect = useCallback((preset: PresetTemplate) => {
    form.reset({
      name: preset.name, chain: preset.chain as CreateRuleFormData["chain"],
      protocol: preset.protocol as CreateRuleFormData["protocol"],
      source: "", destination: "", port: preset.port,
      action: preset.action as CreateRuleFormData["action"],
    });
    setEditId(null);
    setShowForm(true);
    setShowPresets(false);
  }, [form]);

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

  return {
    // Form
    form,
    // State
    showForm, setShowForm,
    showPresets, setShowPresets,
    editId, setEditId,
    selectedIds, setSelectedIds,
    // Data
    rules, status, presets,
    // Loading states
    isLoading: rulesQuery.isLoading,
    isFormPending: createMutation.isPending || updateMutation.isPending,
    isApplyPending: applyMutation.isPending,
    isBatchPending: batchToggleMutation.isPending || batchDeleteMutation.isPending,
    allSelected,
    // Actions
    handleSubmit,
    handleEdit,
    handleDelete,
    handlePresetSelect,
    moveRule,
    toggleSelect,
    toggleSelectAll,
    // Mutations
    applyMutation,
    batchToggleMutation,
    batchDeleteMutation,
    toggleMutation,
  };
}
