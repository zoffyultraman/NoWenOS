import { useAlertsPage } from "@/features/alerts/hooks/useAlertsPage";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useTranslation } from "@/hooks/useTranslation";
import { AlertRuleForm } from "@/features/alerts/components/AlertRuleForm";
import { AlertRulesList } from "@/features/alerts/components/AlertRulesList";
import { AlertEventsHistory } from "@/features/alerts/components/AlertEventsHistory";
import { ChannelManager } from "@/features/alerts/components/ChannelManager";
import { Plus } from "lucide-react";

export default function AlertsPage() {
  const t = useTranslation();
  const {
    showForm, setShowForm,
    form, setForm,
    showChannelForm, setShowChannelForm,
    channelForm, setChannelForm,
    channelTab, setChannelTab,
    linkRuleId, setLinkRuleId,
    selectedChannelIds,
    deleteRuleConfirm, setDeleteRuleConfirm,
    deleteChannelConfirm, setDeleteChannelConfirm,
    channels, rules, events, unseen,
    createMutation, toggleMutation, deleteRuleMutation,
    markSeenMutation, createChannelMutation, deleteChannelMutation,
    toggleChannelMutation, clearEventsMutation,
    linkChannelsMutation, testChannelMutation,
    openLinkDialog, toggleChannelSelection, handleSubmit,
  } = useAlertsPage();

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("alerts.title")}</h1>
          <p className="text-muted-foreground">{t("alerts.subtitle")}</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="mr-2 h-4 w-4" /> {t("alerts.addRule")}
        </Button>
      </div>

      {/* Rule form */}
      {showForm && (
        <AlertRuleForm
          form={form} setForm={setForm}
          onClose={() => setShowForm(false)} onSubmit={handleSubmit}
          isPending={createMutation.isPending}
        />
      )}

      {/* Tab switcher */}
      <div className="flex gap-2">
        <button onClick={() => setChannelTab(false)} className={"rounded-full px-3 py-1 text-xs font-medium transition-colors " + (!channelTab ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent")}>
          {t("alerts.rulesAndHistory")}
        </button>
        <button onClick={() => setChannelTab(true)} className={"rounded-full px-3 py-1 text-xs font-medium transition-colors " + (channelTab ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent")}>
          {t("alerts.notificationChannels")}
        </button>
      </div>

      {/* Rules & History tab */}
      {!channelTab && (
        <>
          <AlertRulesList
            rules={rules} onOpenLinkDialog={openLinkDialog}
            onToggle={(args) => toggleMutation.mutate(args)}
            onDeleteClick={(r) => setDeleteRuleConfirm(r)}
          />
          <AlertEventsHistory
            events={events} unseen={unseen}
            onMarkSeen={() => markSeenMutation.mutate()}
            onClearEvents={() => clearEventsMutation.mutate()}
          />
        </>
      )}

      {/* Channels tab */}
      {channelTab && (
        <ChannelManager
          channels={channels}
          showChannelForm={showChannelForm} setShowChannelForm={setShowChannelForm}
          channelForm={channelForm} setChannelForm={setChannelForm}
          onCreateChannel={() => createChannelMutation.mutate(channelForm)}
          isCreating={createChannelMutation.isPending}
          onToggleChannel={(args) => toggleChannelMutation.mutate(args)}
          onTestChannel={(id) => testChannelMutation.mutate(id)}
          isTesting={testChannelMutation.isPending}
          onDeleteClick={(ch) => setDeleteChannelConfirm(ch)}
          linkRuleId={linkRuleId} onCloseLinkDialog={() => setLinkRuleId(null)}
          selectedChannelIds={selectedChannelIds} onToggleSelection={toggleChannelSelection}
          onLinkChannels={() => linkChannelsMutation.mutate({ ruleId: linkRuleId!, channelIds: selectedChannelIds })}
          isLinking={linkChannelsMutation.isPending}
        />
      )}

      {/* Confirm dialogs */}
      {deleteRuleConfirm && (
        <ConfirmDialog title={t("common.confirm")} message={t("alerts.deleteRuleConfirm").replace("{name}", deleteRuleConfirm.name)} onConfirm={() => { deleteRuleMutation.mutate(deleteRuleConfirm.id); setDeleteRuleConfirm(null); }} onCancel={() => setDeleteRuleConfirm(null)} />
      )}
      {deleteChannelConfirm && (
        <ConfirmDialog title={t("common.confirm")} message={t("alerts.deleteChannelConfirm").replace("{name}", deleteChannelConfirm.name)} onConfirm={() => { deleteChannelMutation.mutate(deleteChannelConfirm.id); setDeleteChannelConfirm(null); }} onCancel={() => setDeleteChannelConfirm(null)} />
      )}
    </div>
  );
}
