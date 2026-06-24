import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchInterfaces,
  configureInterface,
  bringUpInterface,
  bringDownInterface,
  fetchDNS,
  updateDNS,
  formatBytes,
} from "@/features/network/api";
import type { NetworkInterface, InterfaceConfig, DNSConfig } from "@/features/network/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/stores/toast";
import { useTranslation } from "@/hooks/useTranslation";
import {
  ArrowUp, ArrowDown, Settings, X, Save, Plus, Trash2,
  Wifi, Server,
} from "lucide-react";

export default function NetworkPage() {
  const t = useTranslation();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [configTarget, setConfigTarget] = useState<NetworkInterface | null>(null);
  const [configForm, setConfigForm] = useState<InterfaceConfig>({
    name: "",
    mode: "dhcp",
    address: "",
    netmask: "255.255.255.0",
    gateway: "",
    dns: [],
  });
  const [dnsForm, setDnsForm] = useState<DNSConfig>({ servers: [], search: [] });
  const [newDnsServer, setNewDnsServer] = useState("");

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
  if (dnsData && dnsForm.servers.length === 0 && dnsData.servers && dnsData.servers.length > 0) {
    setDnsForm({ servers: [...dnsData.servers], search: dnsData.search ? [...dnsData.search] : [] });
  }

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
    setConfigForm({
      name: iface.name,
      mode: iface.config?.mode ?? "dhcp",
      address: iface.config?.address ?? "",
      netmask: iface.config?.netmask ?? "255.255.255.0",
      gateway: iface.config?.gateway ?? "",
      dns: iface.config?.dns ? [...iface.config.dns] : [],
    });
  }

  function handleConfigSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!configTarget) return;
    configureMutation.mutate({ name: configTarget.name, config: configForm });
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

  function formatSpeed(bytes: number): string {
    return formatBytes(bytes);
  }

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("network.title")}</h1>
        <p className="text-muted-foreground">{t("network.subtitle")}</p>
      </div>

      {ifacesQuery.isLoading && (
        <p className="text-sm text-muted-foreground">{t("network.loading")}</p>
      )}

      {ifacesQuery.isError && (
        <Card className="border-danger/30 bg-danger/5">
          <CardContent className="pt-6">
            <p className="text-sm text-danger">{t("network.failed")}</p>
          </CardContent>
        </Card>
      )}

      {/* Interface List */}
      <div className="space-y-3">
        {interfaces.map((iface) => (
          <Card key={iface.name} className="border-border bg-card transition-all duration-200 hover:border-border/80">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                {/* Left: Interface Info */}
                <div className="flex items-center gap-4">
                  <div
                    className={
                      "flex h-10 w-10 items-center justify-center rounded-xl transition-all " +
                      (iface.status === "up"
                        ? "bg-green-500/10 text-green-400 shadow-sm shadow-green-500/10"
                        : "bg-muted text-muted-foreground")
                    }
                  >
                    <Wifi className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{iface.name}</p>
                      <span
                        className={
                          "rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider " +
                          (iface.status === "up"
                            ? "border border-green-500/20 bg-green-500/10 text-green-400"
                            : "border border-slate-500/20 bg-slate-500/10 text-slate-400")
                        }
                      >
                        {iface.status === "up" ? t("network.up") : t("network.down")}
                      </span>
                      {iface.isConfigured && iface.config && (
                        <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-cyan-400">
                          {iface.config.mode === "dhcp" ? t("network.dhcp") : t("network.static")}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t("network.mac")}: {iface.mac || t("common.na")}
                    </p>
                  </div>
                </div>

                {/* Center: Address & Traffic */}
                <div className="hidden md:flex items-center gap-8">
                  <div className="text-center min-w-[140px]">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">{t("network.ip")}</p>
                    <p className="text-sm font-mono font-medium">{iface.ipAddress || t("common.na")}</p>
                  </div>
                  <div className="text-center min-w-[100px]">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">{t("network.speed")}</p>
                    <p className="text-sm font-medium">{iface.speed}</p>
                  </div>
                  <div className="text-center min-w-[80px]">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">{t("network.mtu")}</p>
                    <p className="text-sm font-medium">{iface.mtu}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                        <ArrowDown className="h-3 w-3 text-green-400" /> {t("network.rx")}
                      </p>
                      <p className="text-xs font-mono font-medium text-green-400">{formatSpeed(iface.rxBytes)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                        <ArrowUp className="h-3 w-3 text-cyan-400" /> {t("network.tx")}
                      </p>
                      <p className="text-xs font-mono font-medium text-cyan-400">{formatSpeed(iface.txBytes)}</p>
                    </div>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openConfig(iface)}
                    className="h-8 w-8 p-0"
                    title={t("network.configure")}
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                  {iface.status === "up" ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => downMutation.mutate(iface.name)}
                      disabled={downMutation.isPending}
                      className="h-8 w-8 p-0 text-amber-500 hover:text-amber-600"
                      title={t("network.bringDown")}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => upMutation.mutate(iface.name)}
                      disabled={upMutation.isPending}
                      className="h-8 w-8 p-0 text-green-500 hover:text-green-600"
                      title={t("network.bringUp")}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Mobile: extra details below */}
              <div className="mt-3 flex flex-wrap gap-4 md:hidden text-xs text-muted-foreground">
                <span>{t("network.ip")}: <span className="font-mono font-medium text-foreground">{iface.ipAddress || t("common.na")}</span></span>
                <span>{t("network.speed")}: <span className="font-medium text-foreground">{iface.speed}</span></span>
                <span>{t("network.mtu")}: <span className="font-medium text-foreground">{iface.mtu}</span></span>
                <span className="text-green-400">{t("network.rx")}: {formatSpeed(iface.rxBytes)}</span>
                <span className="text-cyan-400">{t("network.tx")}: {formatSpeed(iface.txBytes)}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {interfaces.length === 0 && !ifacesQuery.isLoading && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">{t("network.noInterfaces")}</p>
          </CardContent>
        </Card>
      )}

      {/* Configure Interface Dialog */}
      {configTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <Card className="w-full max-w-lg mx-4 border-border bg-card shadow-2xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <CardTitle className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/10">
                  <Settings className="h-4 w-4 text-cyan-400" />
                </div>
                {t("network.configure")} - {configTarget.name}
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setConfigTarget(null)}>
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleConfigSubmit} className="space-y-4">
                {/* Mode Toggle */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {t("network.mode")}
                  </Label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setConfigForm((prev) => ({ ...prev, mode: "dhcp" }))}
                      className={
                        "rounded-xl border px-4 py-2 text-sm font-medium transition-all " +
                        (configForm.mode === "dhcp"
                          ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-400 shadow-sm shadow-cyan-500/10"
                          : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/50")
                      }
                    >
                      DHCP
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfigForm((prev) => ({ ...prev, mode: "static" }))}
                      className={
                        "rounded-xl border px-4 py-2 text-sm font-medium transition-all " +
                        (configForm.mode === "static"
                          ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-400 shadow-sm shadow-cyan-500/10"
                          : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/50")
                      }
                    >
                      {t("network.static")}
                    </button>
                  </div>
                </div>

                {/* Static IP Fields */}
                {configForm.mode === "static" && (
                  <div className="space-y-4 rounded-lg border border-border bg-muted/20 p-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="cfg-address" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          {t("network.address")}
                        </Label>
                        <Input
                          id="cfg-address"
                          value={configForm.address ?? ""}
                          onChange={(e) => setConfigForm((prev) => ({ ...prev, address: e.target.value }))}
                          placeholder="192.168.1.100"
                          className="bg-muted/50 border-border focus:border-primary font-mono"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="cfg-netmask" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          {t("network.netmask")}
                        </Label>
                        <Input
                          id="cfg-netmask"
                          value={configForm.netmask ?? ""}
                          onChange={(e) => setConfigForm((prev) => ({ ...prev, netmask: e.target.value }))}
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
                        value={configForm.gateway ?? ""}
                        onChange={(e) => setConfigForm((prev) => ({ ...prev, gateway: e.target.value }))}
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
                    disabled={configureMutation.isPending}
                    className="bg-gradient-to-r from-cyan-500 to-cyan-600 text-white shadow-lg shadow-cyan-500/20 hover:from-cyan-400 hover:to-cyan-500 transition-all"
                  >
                    <Save className="mr-2 h-4 w-4" />
                    {configureMutation.isPending ? t("network.saving") : t("network.save")}
                  </Button>
                  <Button variant="outline" type="button" onClick={() => setConfigTarget(null)}>
                    {t("common.cancel")}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* DNS Configuration */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10">
              <Server className="h-4 w-4 text-purple-400" />
            </div>
            {t("network.dnsTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleDnsSubmit} className="space-y-4">
            {/* DNS Servers */}
            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {t("network.dnsServers")}
              </Label>
              <div className="space-y-2">
                {dnsForm.servers.map((server, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      value={server}
                      readOnly
                      className="bg-muted/50 border-border font-mono flex-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeDnsServer(index)}
                      className="h-9 w-9 p-0 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Input
                  value={newDnsServer}
                  onChange={(e) => setNewDnsServer(e.target.value)}
                  placeholder={t("network.dnsPlaceholder")}
                  className="bg-muted/50 border-border focus:border-primary font-mono"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addDnsServer();
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addDnsServer}
                  className="shrink-0"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  {t("network.addDns")}
                </Button>
              </div>
            </div>

            {/* Search Domains */}
            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {t("network.dnsSearch")}
              </Label>
              <Input
                value={dnsForm.search?.join(" ") ?? ""}
                onChange={(e) =>
                  setDnsForm((prev) => ({
                    ...prev,
                    search: e.target.value
                      .split(/[\s,]+/)
                      .map((s) => s.trim())
                      .filter(Boolean),
                  }))
                }
                placeholder="example.com"
                className="bg-muted/50 border-border focus:border-primary"
              />
            </div>

            <Button
              type="submit"
              disabled={dnsMutation.isPending}
              className="bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-lg shadow-purple-500/20 hover:from-purple-400 hover:to-purple-500 transition-all"
            >
              <Save className="mr-2 h-4 w-4" />
              {dnsMutation.isPending ? t("network.saving") : t("common.save")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
