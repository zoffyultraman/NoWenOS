import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  fetchInterfaces,
  configureInterface,
  bringUpInterface,
  bringDownInterface,
  fetchDNS,
  updateDNS,
} from "@/features/network/api";
import type { NetworkInterface, InterfaceConfig, DNSConfig } from "@/features/network/api";
import { interfaceConfigSchema, type InterfaceConfigFormData } from "@/features/network/schemas";
import { useToast } from "@/stores/toast";
import { useTranslation } from "@/hooks/useTranslation";

export function useNetworkForm() {
  const t = useTranslation();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [configTarget, setConfigTarget] = useState<NetworkInterface | null>(null);
  const [dnsForm, setDnsForm] = useState<DNSConfig>({ servers: [], search: [] });
  const [newDnsServer, setNewDnsServer] = useState("");

  // Interface config form
  const configForm = useForm<InterfaceConfigFormData>({
    resolver: zodResolver(interfaceConfigSchema),
    defaultValues: { name: "", mode: "dhcp", address: "", netmask: "255.255.255.0", gateway: "", dns: [] },
  });
  const configMode = configForm.watch("mode");

  // Queries
  const ifacesQuery = useQuery({
    queryKey: ["network-interfaces"],
    queryFn: fetchInterfaces,
    refetchInterval: 5000,
  });
  const dnsQuery = useQuery({
    queryKey: ["network-dns"],
    queryFn: fetchDNS,
  });

  // Sync DNS form with fetched data
  const dnsData = dnsQuery.data?.data;
  useEffect(() => {
    if (dnsData && dnsData.servers && dnsData.servers.length > 0) {
      setDnsForm((prev) => {
        if (prev.servers.length > 0) return prev;
        return { servers: [...dnsData.servers], search: dnsData.search ? [...dnsData.search] : [] };
      });
    }
  }, [dnsData]);

  // Mutations
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

  const upMutation = useMutation({
    mutationFn: bringUpInterface,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["network-interfaces"] });
      toast.success(t("network.upSuccess"));
    },
    onError: (err: Error) => toast.error(err.message || t("network.upFailed")),
  });

  const downMutation = useMutation({
    mutationFn: bringDownInterface,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["network-interfaces"] });
      toast.success(t("network.downSuccess"));
    },
    onError: (err: Error) => toast.error(err.message || t("network.downFailed")),
  });

  const dnsMutation = useMutation({
    mutationFn: updateDNS,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["network-dns"] });
      toast.success(t("network.dnsSaved"));
    },
    onError: (err: Error) => toast.error(err.message || t("network.dnsFailed")),
  });

  const interfaces = ifacesQuery.data?.data ?? [];

  // Handlers
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

  function handleDnsSubmit(e: React.FormEvent) {
    e.preventDefault();
    dnsMutation.mutate(dnsForm);
  }

  function addDnsServer() {
    const server = newDnsServer.trim();
    if (!server) return;
    if (dnsForm.servers.includes(server)) return;
    setDnsForm((prev) => ({ ...prev, servers: [...prev.servers, server] }));
    setNewDnsServer("");
  }

  function removeDnsServer(index: number) {
    setDnsForm((prev) => ({
      ...prev,
      servers: prev.servers.filter((_, i) => i !== index),
    }));
  }

  return {
    // State
    configTarget,
    setConfigTarget,
    configForm,
    configMode,
    dnsForm,
    setDnsForm,
    newDnsServer,
    setNewDnsServer,
    interfaces,
    // Queries
    ifacesQuery,
    dnsQuery,
    // Mutations
    configureMutation,
    upMutation,
    downMutation,
    dnsMutation,
    // Handlers
    openConfig,
    onConfigSubmit,
    handleDnsSubmit,
    addDnsServer,
    removeDnsServer,
  };
}
