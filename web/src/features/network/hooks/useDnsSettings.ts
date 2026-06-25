import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { fetchDNS, updateDNS } from "@/features/network/api";
import type { DNSConfig } from "@/features/network/api";
import { useToast } from "@/stores/toast";
import { useTranslation } from "@/hooks/useTranslation";

const dnsSettingsSchema = z.object({
  servers: z.array(z.string().min(1, "DNS server cannot be empty")),
  search: z.string().optional().default(""),
});

export type DnsSettingsFormData = z.infer<typeof dnsSettingsSchema>;

export function useDnsSettings() {
  const t = useTranslation();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [newDnsServer, setNewDnsServer] = useState("");

  const dnsQuery = useQuery({
    queryKey: ["network-dns"],
    queryFn: fetchDNS,
  });

  const dnsForm = useForm<DnsSettingsFormData>({
    resolver: zodResolver(dnsSettingsSchema),
    defaultValues: { servers: [], search: "" },
  });

  // Sync form with fetched DNS data
  const dnsData = dnsQuery.data?.data;
  useEffect(() => {
    if (dnsData && dnsData.servers && dnsData.servers.length > 0) {
      const currentServers = dnsForm.getValues("servers");
      if (currentServers.length > 0) return;
      dnsForm.setValue("servers", [...dnsData.servers]);
      dnsForm.setValue("search", dnsData.search ? dnsData.search.join(" ") : "");
    }
  }, [dnsData, dnsForm]);

  const dnsMutation = useMutation({
    mutationFn: updateDNS,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["network-dns"] });
      toast.success(t("network.dnsSaved"));
    },
    onError: (err: Error) => toast.error(err.message || t("network.dnsFailed")),
  });

  const dnsServers = dnsForm.watch("servers");

  function addDnsServer() {
    const server = newDnsServer.trim();
    if (!server) return;
    if (dnsServers.includes(server)) return;
    dnsForm.setValue("servers", [...dnsServers, server]);
    setNewDnsServer("");
  }

  function removeDnsServer(index: number) {
    dnsForm.setValue(
      "servers",
      dnsServers.filter((_, i) => i !== index),
    );
  }

  function handleDnsSubmit(data: DnsSettingsFormData) {
    const payload: DNSConfig = {
      servers: data.servers,
      search: data.search
        ? data.search
            .split(/[\s,]+/)
            .map((s) => s.trim())
            .filter(Boolean)
        : [],
    };
    dnsMutation.mutate(payload);
  }

  // Expose a compatible interface for DnsSettingsCard
  const dnsFormState: DNSConfig = {
    servers: dnsServers,
    search: dnsForm.watch("search")
      ?.split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean) ?? [],
  };

  function setDnsFormState(updater: React.SetStateAction<DNSConfig>) {
    const next = typeof updater === "function" ? updater(dnsFormState) : updater;
    dnsForm.setValue("servers", next.servers);
    dnsForm.setValue("search", next.search?.join(" ") ?? "");
  }

  return {
    dnsForm,
    dnsFormState,
    setDnsFormState,
    newDnsServer,
    setNewDnsServer,
    dnsQuery,
    dnsMutation,
    addDnsServer,
    removeDnsServer,
    handleDnsSubmit,
  };
}
