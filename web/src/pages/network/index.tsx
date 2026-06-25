import { useNetworkInterfaces } from "@/features/network/hooks/useNetworkInterfaces";
import { useInterfaceConfig } from "@/features/network/hooks/useInterfaceConfig";
import { useDnsSettings } from "@/features/network/hooks/useDnsSettings";
import { NetworkInterfaceList } from "@/features/network/components/NetworkInterfaceList";
import { NetworkConfigForm } from "@/features/network/components/NetworkConfigForm";
import { DnsSettingsCard } from "@/features/network/components/DnsSettingsCard";
import { useTranslation } from "@/hooks/useTranslation";

export default function NetworkPage() {
  const t = useTranslation();

  const {
    interfaces,
    ifacesQuery,
    upMutation,
    downMutation,
  } = useNetworkInterfaces();

  const {
    configTarget,
    setConfigTarget,
    configForm,
    configMode,
    configureMutation,
    openConfig,
    onConfigSubmit,
  } = useInterfaceConfig();

  const {
    dnsForm,
    dnsFormState,
    setDnsFormState,
    newDnsServer,
    setNewDnsServer,
    dnsMutation,
    addDnsServer,
    removeDnsServer,
    handleDnsSubmit,
  } = useDnsSettings();

  return (
    <div className="space-y-4 p-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("network.title")}</h1>
        <p className="text-muted-foreground">{t("network.subtitle")}</p>
      </div>

      <NetworkInterfaceList
        interfaces={interfaces}
        isLoading={ifacesQuery.isLoading}
        isError={!!ifacesQuery.isError}
        onConfigure={openConfig}
        onBringUp={upMutation.mutate}
        onBringDown={downMutation.mutate}
        isUpPending={upMutation.isPending}
        isDownPending={downMutation.isPending}
      />

      <NetworkConfigForm
        configTarget={configTarget}
        form={configForm}
        configMode={configMode}
        isPending={configureMutation.isPending}
        onSubmit={onConfigSubmit}
        onClose={() => setConfigTarget(null)}
      />

      <DnsSettingsCard
        dnsForm={dnsFormState}
        onDnsFormChange={setDnsFormState}
        newDnsServer={newDnsServer}
        onNewDnsServerChange={setNewDnsServer}
        onAddDnsServer={addDnsServer}
        onRemoveDnsServer={removeDnsServer}
        onSubmit={dnsForm.handleSubmit(handleDnsSubmit)}
        isPending={dnsMutation.isPending}
      />
    </div>
  );
}
