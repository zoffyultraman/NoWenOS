import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslation } from "@/hooks/useTranslation";
import { useToast } from "@/stores/toast";
import type { WizardState } from "@/features/vpn/hooks/useVPNForm";
import type { UseMutationResult } from "@tanstack/react-query";
import { Key, Copy, Check, ChevronRight, ChevronLeft, X } from "lucide-react";

interface VPNWizardProps {
  wizard: WizardState;
  setWizard: React.Dispatch<React.SetStateAction<WizardState>>;
  wizardName: string;
  setWizardName: (name: string) => void;
  genKeysMutation: UseMutationResult;
  genConfigMutation: UseMutationResult;
  createMutation: UseMutationResult;
  onClose: () => void;
}

export function VPNWizard({
  wizard, setWizard, wizardName, setWizardName,
  genKeysMutation, genConfigMutation, createMutation, onClose,
}: VPNWizardProps) {
  const t = useTranslation();
  const toast = useToast();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border bg-background p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{t("vpn.wizard")}</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Step Indicators */}
        <div className="flex items-center gap-2 mb-6">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={
                  "flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium " +
                  (wizard.step >= s
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground")
                }
              >
                {wizard.step > s ? <Check className="h-3.5 w-3.5" /> : s}
              </div>
              {s < 4 && <div className={"h-px w-8 " + (wizard.step > s ? "bg-primary" : "bg-muted")} />}
            </div>
          ))}
        </div>

        {/* Step 1: Generate Keys */}
        {wizard.step === 1 && (
          <div className="space-y-4">
            <h3 className="text-sm font-medium">{t("vpn.wizardStep1")}</h3>
            <Button
              onClick={() => genKeysMutation.mutate()}
              disabled={genKeysMutation.isPending}
              className="w-full"
            >
              <Key className="mr-2 h-4 w-4" />
              {genKeysMutation.isPending ? t("common.loading") : t("vpn.generateKeys")}
            </Button>
            {wizard.keys && (
              <div className="space-y-2">
                <div>
                  <Label className="text-xs">{t("vpn.privateKey")}</Label>
                  <div className="flex items-center gap-1 mt-1">
                    <Input value={wizard.keys.privateKey} readOnly className="font-mono text-xs" />
                    <Button
                      variant="outline"
                      size="icon"
                      className="shrink-0"
                      onClick={() => { navigator.clipboard.writeText(wizard.keys!.privateKey); toast.success(t("vpn.copied")); }}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div>
                  <Label className="text-xs">{t("vpn.publicKey")}</Label>
                  <div className="flex items-center gap-1 mt-1">
                    <Input value={wizard.keys.publicKey} readOnly className="font-mono text-xs" />
                    <Button
                      variant="outline"
                      size="icon"
                      className="shrink-0"
                      onClick={() => { navigator.clipboard.writeText(wizard.keys!.publicKey); toast.success(t("vpn.copied")); }}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
            <div className="flex justify-end">
              <Button
                onClick={() => setWizard((w) => ({ ...w, step: 2 }))}
                disabled={!wizard.keys}
              >
                {t("vpn.next")} <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Configure Interface */}
        {wizard.step === 2 && (
          <div className="space-y-4">
            <h3 className="text-sm font-medium">{t("vpn.wizardStep2")}</h3>
            <div>
              <Label>{t("vpn.address")}</Label>
              <Input
                value={wizard.params.address}
                onChange={(e) => setWizard((w) => ({ ...w, params: { ...w.params, address: e.target.value } }))}
                placeholder={t("vpn.addressPlaceholder")}
                className="mt-1"
              />
            </div>
            <div>
              <Label>{t("vpn.dns")}</Label>
              <Input
                value={wizard.params.dns}
                onChange={(e) => setWizard((w) => ({ ...w, params: { ...w.params, dns: e.target.value } }))}
                placeholder={t("vpn.dnsPlaceholder")}
                className="mt-1"
              />
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setWizard((w) => ({ ...w, step: 1 }))}>
                <ChevronLeft className="mr-1 h-4 w-4" /> {t("vpn.back")}
              </Button>
              <Button onClick={() => setWizard((w) => ({ ...w, step: 3 }))}>
                {t("vpn.next")} <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Configure Peer */}
        {wizard.step === 3 && (
          <div className="space-y-4">
            <h3 className="text-sm font-medium">{t("vpn.wizardStep3")}</h3>
            <div>
              <Label>{t("vpn.publicKey")} (Peer)</Label>
              <Input
                value={wizard.params.publicKey}
                onChange={(e) => setWizard((w) => ({ ...w, params: { ...w.params, publicKey: e.target.value } }))}
                placeholder={t("vpn.publicKey")}
                className="mt-1 font-mono text-xs"
              />
            </div>
            <div>
              <Label>{t("vpn.endpoint")}</Label>
              <Input
                value={wizard.params.endpoint}
                onChange={(e) => setWizard((w) => ({ ...w, params: { ...w.params, endpoint: e.target.value } }))}
                placeholder={t("vpn.endpointPlaceholder")}
                className="mt-1"
              />
            </div>
            <div>
              <Label>{t("vpn.allowedIPs")}</Label>
              <Input
                value={wizard.params.allowedIPs}
                onChange={(e) => setWizard((w) => ({ ...w, params: { ...w.params, allowedIPs: e.target.value } }))}
                placeholder={t("vpn.allowedIPsPlaceholder")}
                className="mt-1"
              />
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setWizard((w) => ({ ...w, step: 2 }))}>
                <ChevronLeft className="mr-1 h-4 w-4" /> {t("vpn.back")}
              </Button>
              <Button
                onClick={() => genConfigMutation.mutate({
                  ...wizard.params,
                  privateKey: wizard.keys?.privateKey || wizard.params.privateKey,
                })}
                disabled={genConfigMutation.isPending || !wizard.params.publicKey || !wizard.params.endpoint}
              >
                {genConfigMutation.isPending ? t("common.loading") : t("vpn.finish")}
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Review & Save */}
        {wizard.step === 4 && (
          <div className="space-y-4">
            <h3 className="text-sm font-medium">{t("vpn.config")}</h3>
            <pre className="rounded-md border bg-muted/50 p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap">
              {wizard.generatedConfig}
            </pre>
            <div>
              <Label>{t("vpn.configName")}</Label>
              <Input
                value={wizardName}
                onChange={(e) => setWizardName(e.target.value)}
                placeholder={t("vpn.configNamePlaceholder")}
                className="mt-1"
              />
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setWizard((w) => ({ ...w, step: 3 }))}>
                <ChevronLeft className="mr-1 h-4 w-4" /> {t("vpn.back")}
              </Button>
              <Button
                onClick={() => {
                  createMutation.mutate({
                    name: wizardName || "WireGuard",
                    type: "wireguard",
                    config: wizard.generatedConfig,
                  });
                }}
                disabled={createMutation.isPending || !wizardName}
              >
                {createMutation.isPending ? t("common.loading") : t("vpn.create")}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
