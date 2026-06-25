import type { UseFormReturn } from "react-hook-form";
import type { InterfaceConfigFormData } from "@/features/network/schemas";
import type { NetworkInterface } from "@/features/network/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslation } from "@/hooks/useTranslation";
import { Settings, X, Save } from "lucide-react";

interface NetworkConfigFormProps {
  configTarget: NetworkInterface | null;
  form: UseFormReturn<InterfaceConfigFormData>;
  configMode: string;
  isPending: boolean;
  onSubmit: (data: InterfaceConfigFormData) => void;
  onClose: () => void;
}

export function NetworkConfigForm({
  configTarget,
  form,
  configMode,
  isPending,
  onSubmit,
  onClose,
}: NetworkConfigFormProps) {
  const t = useTranslation();
  const { register, handleSubmit, formState: { errors }, setValue } = form;

  if (!configTarget) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <Card className="w-full max-w-lg mx-4 border-border bg-card shadow-2xl">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/10">
              <Settings className="h-4 w-4 text-cyan-400" />
            </div>
            {t("network.configure")} - {configTarget.name}
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Mode Toggle */}
            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {t("network.mode")}
              </Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setValue("mode", "dhcp")}
                  className={
                    "rounded-xl border px-4 py-2 text-sm font-medium transition-all " +
                    (configMode === "dhcp"
                      ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-400 shadow-sm shadow-cyan-500/10"
                      : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/50")
                  }
                >
                  DHCP
                </button>
                <button
                  type="button"
                  onClick={() => setValue("mode", "static")}
                  className={
                    "rounded-xl border px-4 py-2 text-sm font-medium transition-all " +
                    (configMode === "static"
                      ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-400 shadow-sm shadow-cyan-500/10"
                      : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/50")
                  }
                >
                  {t("network.static")}
                </button>
              </div>
            </div>

            {/* Static IP Fields */}
            {configMode === "static" && (
              <div className="space-y-4 rounded-lg border border-border bg-muted/20 p-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="cfg-address" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      {t("network.address")}
                    </Label>
                    <Input
                      id="cfg-address"
                      {...register("address")}
                      placeholder="192.168.1.100"
                      className="bg-muted/50 border-border focus:border-primary font-mono"
                    />
                    {errors.address && (
                      <p className="text-xs text-destructive">{errors.address.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cfg-netmask" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      {t("network.netmask")}
                    </Label>
                    <Input
                      id="cfg-netmask"
                      {...register("netmask")}
                      placeholder="255.255.255.0"
                      className="bg-muted/50 border-border focus:border-primary font-mono"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cfg-gateway" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {t("network.gateway")}
                  </Label>
                  <Input
                    id="cfg-gateway"
                    {...register("gateway")}
                    placeholder="192.168.1.1"
                    className="bg-muted/50 border-border focus:border-primary font-mono"
                  />
                </div>
              </div>
            )}

            {/* Current Info (read-only) */}
            <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-muted/10 p-3 text-xs">
              <div>
                <span className="text-muted-foreground">{t("network.mac")}:</span>
                <span className="ml-1 font-mono">{configTarget.mac || t("common.na")}</span>
              </div>
              <div>
                <span className="text-muted-foreground">{t("network.speed")}:</span>
                <span className="ml-1">{configTarget.speed}</span>
              </div>
              <div>
                <span className="text-muted-foreground">{t("network.ip")}:</span>
                <span className="ml-1 font-mono">{configTarget.ipAddress || t("common.na")}</span>
              </div>
              <div>
                <span className="text-muted-foreground">{t("network.mtu")}:</span>
                <span className="ml-1">{configTarget.mtu}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                type="submit"
                disabled={isPending}
                className="bg-gradient-to-r from-cyan-500 to-cyan-600 text-white shadow-lg shadow-cyan-500/20 hover:from-cyan-400 hover:to-cyan-500 transition-all"
              >
                <Save className="mr-2 h-4 w-4" />
                {isPending ? t("network.saving") : t("network.save")}
              </Button>
              <Button variant="outline" type="button" onClick={onClose}>
                {t("common.cancel")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
