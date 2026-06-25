import { useVPNForm } from "@/features/vpn/hooks/useVPNForm";
import { VPNStatusBar } from "@/features/vpn/components/VPNStatusBar";
import { VPNConfigList } from "@/features/vpn/components/VPNConfigList";
import { VPNConfigDialog } from "@/features/vpn/components/VPNConfigDialog";
import { VPNWizard } from "@/features/vpn/components/VPNWizard";
import { VPNImportDialog } from "@/features/vpn/components/VPNImportDialog";
import { VPNQRDialog } from "@/features/vpn/components/VPNQRDialog";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";
import { Key, Upload, Plus } from "lucide-react";

export default function VPNPage() {
  const t = useTranslation();
  const {
    dialog,
    wizardName, setWizardName,
    importName, setImportName,
    wizard, setWizard,
    importText, setImportText,
    parsedInfo, qrTarget,
    connectingId,
    register, handleFormSubmit, errors,
    configs, status,
    configsQuery,
    createMutation, updateMutation, connectMutation, disconnectMutation,
    genKeysMutation, genConfigMutation, parseMutation,
    closeDialog, openAdd, openEdit, openWizard, openImport, openQR,
    onSubmit, handleDelete, handleConnect, handleDisconnect, isCurrentVPN,
  } = useVPNForm();

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("vpn.title")}</h1>
          <p className="text-muted-foreground">{t("vpn.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={openWizard}>
            <Key className="mr-2 h-4 w-4" />
            {t("vpn.wizard")}
          </Button>
          <Button variant="outline" onClick={openImport}>
            <Upload className="mr-2 h-4 w-4" />
            {t("vpn.importOpenVPN")}
          </Button>
          <Button onClick={openAdd}>
            <Plus className="mr-2 h-4 w-4" />
            {t("vpn.addConfig")}
          </Button>
        </div>
      </div>

      <VPNStatusBar status={status} />

      {/* Dialogs */}
      {(dialog === "add" || dialog === "edit") && (
        <VPNConfigDialog
          mode={dialog}
          form={{ register, handleSubmit: handleFormSubmit, formState: { errors }, watch: () => "", setValue: () => {}, reset: () => {} } as any}
          isPending={createMutation.isPending || updateMutation.isPending}
          onSubmit={onSubmit}
          onClose={closeDialog}
        />
      )}

      {dialog === "wizard" && (
        <VPNWizard
          wizard={wizard}
          setWizard={setWizard}
          wizardName={wizardName}
          setWizardName={setWizardName}
          genKeysMutation={genKeysMutation as any}
          genConfigMutation={genConfigMutation as any}
          createMutation={createMutation as any}
          onClose={closeDialog}
        />
      )}

      {dialog === "import" && (
        <VPNImportDialog
          importText={importText}
          setImportText={setImportText}
          importName={importName}
          setImportName={setImportName}
          parsedInfo={parsedInfo}
          isParsePending={parseMutation.isPending}
          isCreatePending={createMutation.isPending}
          onParse={() => { if (importText.trim()) parseMutation.mutate(importText); }}
          onCreate={() => {
            createMutation.mutate({
              name: importName || "OpenVPN",
              type: "openvpn",
              config: importText,
            });
          }}
          onClose={closeDialog}
        />
      )}

      {dialog === "qrcode" && qrTarget && (
        <VPNQRDialog qrTarget={qrTarget} onClose={closeDialog} />
      )}

      <VPNConfigList
        configs={configs}
        isLoading={configsQuery.isLoading}
        isCurrentVPN={isCurrentVPN}
        connectingId={connectingId}
        statusConnected={status?.connected === true}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
        onEdit={openEdit}
        onDelete={handleDelete}
        onQR={openQR}
        isDisconnectPending={disconnectMutation.isPending}
      />
    </div>
  );
}
