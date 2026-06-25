import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";
import { Plus, RefreshCw, Zap } from "lucide-react";
import { useFirewallPage } from "@/features/firewall/hooks/useFirewallPage";
import { FirewallStatusCard } from "@/features/firewall/components/FirewallStatusCard";
import { BatchActionsBar } from "@/features/firewall/components/BatchActionsBar";
import { PresetTemplatesPanel } from "@/features/firewall/components/PresetTemplatesPanel";
import { FirewallRuleForm } from "@/features/firewall/components/FirewallRuleForm";
import { FirewallRulesTable } from "@/features/firewall/components/FirewallRulesTable";

export default function FirewallPage() {
  const t = useTranslation();
  const {
    form,
    showForm, setShowForm,
    showPresets, setShowPresets,
    editId, setEditId,
    selectedIds, setSelectedIds,
    rules, status, presets,
    isLoading, isFormPending, isApplyPending, isBatchPending, allSelected,
    handleSubmit, handleEdit, handleDelete, handlePresetSelect,
    moveRule, toggleSelect, toggleSelectAll,
    applyMutation, batchToggleMutation, batchDeleteMutation, toggleMutation,
  } = useFirewallPage();

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("firewall.title")}</h1>
          <p className="text-muted-foreground">{t("firewall.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => applyMutation.mutate()} disabled={isApplyPending}>
            <RefreshCw className={"mr-2 h-4 w-4 " + (isApplyPending ? "animate-spin" : "")} />
            {t("firewall.apply")}
          </Button>
          <Button variant="outline" onClick={() => { setShowPresets(!showPresets); setShowForm(false); }}>
            <Zap className="mr-2 h-4 w-4" />
            {t("firewall.presets")}
          </Button>
          <Button onClick={() => { setShowForm(!showForm); setShowPresets(false); setEditId(null); form.reset(); }}>
            <Plus className="mr-2 h-4 w-4" />
            {t("firewall.addRule")}
          </Button>
        </div>
      </div>

      {status && <FirewallStatusCard status={status} />}

      <BatchActionsBar
        selectedCount={selectedIds.size}
        onBatchEnable={() => batchToggleMutation.mutate({ ids: [...selectedIds], enabled: true })}
        onBatchDisable={() => batchToggleMutation.mutate({ ids: [...selectedIds], enabled: false })}
        onBatchDelete={() => { if (confirm(t("firewall.batchDeleteConfirm"))) batchDeleteMutation.mutate([...selectedIds]); }}
        onClearSelection={() => setSelectedIds(new Set())}
        isPending={isBatchPending}
      />

      {showPresets && (
        <PresetTemplatesPanel presets={presets} onSelect={handlePresetSelect} onClose={() => setShowPresets(false)} />
      )}

      {showForm && (
        <FirewallRuleForm
          editId={editId}
          register={form.register}
          errors={form.formState.errors}
          onSubmit={handleSubmit}
          onClose={() => { setShowForm(false); setEditId(null); }}
          isPending={isFormPending}
        />
      )}

      {isLoading && <p className="text-sm text-muted-foreground">{t("common.loading")}</p>}

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
      />
    </div>
  );
}
