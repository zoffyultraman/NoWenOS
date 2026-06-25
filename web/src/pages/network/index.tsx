import { useNetworkForm } from "@/features/network/hooks/useNetworkForm";
import { NetworkInterfaceList } from "@/features/network/components/NetworkInterfaceList";
import { NetworkConfigForm } from "@/features/network/components/NetworkConfigForm";
import { DnsSettingsCard } from "@/features/network/components/DnsSettingsCard";
import { useTranslation } from "@/hooks/useTranslation";

export default function NetworkPage() {
  const t = useTranslation();
  const {
    configTarget,
    setConfigTarget,
    configForm,
    configMode,
    dnsForm,
    setDnsForm,
    newDnsServer,
    setNewDnsServer,
    interfaces,
    ifacesQuery,
    configureMutation,
    upMutation,
    downMutation,
    dnsMutation,
    openConfig,
    onConfigSubmit,
    handleDnsSubmit,
    addDnsServer,
    removeDnsServer,
  } = useNetworkForm();

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
        dnsForm={dnsForm}
        onDnsFormChange={setDnsForm}
        newDnsServer={newDnsServer}
        onNewDnsServerChange={setNewDnsServer}
        onAddDnsServer={addDnsServer}
        onRemoveDnsServer={removeDnsServer}
        onSubmit={handleDnsSubmit}
        isPending={dnsMutation.isPending}
      />
    </div>
  );
}
