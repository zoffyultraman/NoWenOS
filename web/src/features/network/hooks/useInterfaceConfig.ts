import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { configureInterface } from "@/features/network/api";
import type { NetworkInterface, InterfaceConfig } from "@/features/network/api";
import { interfaceConfigSchema, type InterfaceConfigFormData } from "@/features/network/schemas";
import { useToast } from "@/stores/toast";
import { useTranslation } from "@/hooks/useTranslation";

export function useInterfaceConfig() {
  const t = useTranslation();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [configTarget, setConfigTarget] = useState<NetworkInterface | null>(null);

  const configForm = useForm<InterfaceConfigFormData>({
    resolver: zodResolver(interfaceConfigSchema),
    defaultValues: { name: "", mode: "dhcp", address: "", netmask: "255.255.255.0", gateway: "", dns: [] },
  });
  const configMode = configForm.watch("mode");

  const configureMutation = useMutation({
    mutationFn: ({ name, config }: { name: string; config: InterfaceConfig }) =>
      configureInterface(name, config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["network-interfaces"] });
      setConfigTarget(null);
      toast.success(t("network.configSaved"));
    },
    onError: (err: Error) => toast.error(err.message || t("network.configFailed")),
  });

  function openConfig(iface: NetworkInterface) {
    setConfigTarget(iface);
    configForm.reset({
      name: iface.name,
      mode: iface.config?.mode ?? "dhcp",
      address: iface.config?.address ?? "",
      netmask: iface.config?.netmask ?? "255.255.255.0",
      gateway: iface.config?.gateway ?? "",
      dns: iface.config?.dns ? [...iface.config.dns] : [],
    });
  }

  function onConfigSubmit(data: InterfaceConfigFormData) {
    if (!configTarget) return;
    configureMutation.mutate({ name: configTarget.name, config: data });
  }

  return {
    configTarget,
    setConfigTarget,
    configForm,
    configMode,
    configureMutation,
    openConfig,
    onConfigSubmit,
  };
}
