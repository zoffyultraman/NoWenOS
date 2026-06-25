import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { vpnConfigSchema, type VPNConfigFormData } from "@/features/vpn/schemas";
import {
  fetchVPNConfigs, createVPNConfig, updateVPNConfig, deleteVPNConfig,
  connectVPN, disconnectVPN, fetchVPNStatus,
  generateWireGuardKeys, generateWireGuardConfig, parseOpenVPNConfig,
} from "@/features/vpn/api";
import type {
  VPNConfig, VPNStatus, WireGuardKeyPair, WireGuardConfigParams, OpenVPNInfo,
} from "@/features/vpn/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/stores/toast";
import { useTranslation } from "@/hooks/useTranslation";
import {
  Shield, Plus, Trash2, X, Pencil, Wifi, WifiOff,
  Key, Upload, QrCode, ChevronRight, ChevronLeft, Check,
  Copy, Clock, ArrowDownUp, Globe, Server,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

// ─── Helpers ───

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

// ─── Types ───

type DialogMode = "closed" | "add" | "edit" | "wizard" | "import" | "qrcode";

interface WizardState {
  step: number;
  keys: WireGuardKeyPair | null;
  params: WireGuardConfigParams;
  generatedConfig: string;
}

const defaultWizard: WizardState = {
  step: 1,
  keys: null,
  params: {
    privateKey: "",
    address: "10.0.0.2/32",
    dns: "1.1.1.1",
    publicKey: "",
    endpoint: "",
    allowedIPs: "0.0.0.0/0",
  },
  generatedConfig: "",
};

// ─── Main Page ───

export default function VPNPage() {
  const t = useTranslation();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [dialog, setDialog] = useState<DialogMode>("closed");
  const [editId, setEditId] = useState<number | null>(null);
  const [wizardName, setWizardName] = useState("");
  const [importName, setImportName] = useState("");
  const [wizard, setWizard] = useState<WizardState>({ ...defaultWizard, params: { ...defaultWizard.params } });
  const [importText, setImportText] = useState("");
  const [parsedInfo, setParsedInfo] = useState<OpenVPNInfo | null>(null);
  const [qrTarget, setQrTarget] = useState<VPNConfig | null>(null);
  const [connectingId, setConnectingId] = useState<number | null>(null);

  const { register, handleSubmit: handleFormSubmit, formState: { errors }, reset: resetForm } = useForm<VPNConfigFormData>({
    resolver: zodResolver(vpnConfigSchema),
    defaultValues: { name: "", type: "wireguard", config: "" },
  });

  // Queries
  const configsQuery = useQuery({ queryKey: ["vpn-configs"], queryFn: fetchVPNConfigs });
  const statusQuery = useQuery({
    queryKey: ["vpn-status"],
    queryFn: fetchVPNStatus,
    refetchInterval: 5000,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: createVPNConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vpn-configs"] });
      closeDialog();
      toast.success(t("vpn.created"));
    },
    onError: (err: Error) => toast.error(err.message || t("vpn.createFailed")),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { name: string; type: string; config: string } }) =>
      updateVPNConfig(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vpn-configs"] });
      closeDialog();
      toast.success(t("vpn.updated"));
    },
    onError: (err: Error) => toast.error(err.message || t("vpn.updateFailed")),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteVPNConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vpn-configs"] });
      toast.success(t("vpn.deleted"));
    },
    onError: (err: Error) => toast.error(err.message || t("vpn.deleteFailed")),
  });

  const connectMutation = useMutation({
    mutationFn: connectVPN,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vpn-status"] });
      setConnectingId(null);
      toast.success(t("vpn.connectSuccess"));
    },
    onError: (err: Error) => {
      setConnectingId(null);
      toast.error(err.message || t("vpn.connectFailed"));
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: disconnectVPN,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vpn-status"] });
      toast.success(t("vpn.disconnectSuccess"));
    },
    onError: (err: Error) => toast.error(err.message || t("vpn.disconnectFailed")),
  });

  const genKeysMutation = useMutation({
    mutationFn: generateWireGuardKeys,
    onSuccess: (resp) => {
      const keys = resp.data.data;
      setWizard((w) => ({
        ...w,
        keys,
        params: { ...w.params, privateKey: keys.privateKey, publicKey: keys.publicKey },
      }));
      toast.success(t("vpn.keysGenerated"));
    },
    onError: () => toast.error(t("vpn.keyGenFailed")),
  });

  const genConfigMutation = useMutation({
    mutationFn: generateWireGuardConfig,
    onSuccess: (resp) => {
      const config = resp.data.data.config;
      setWizard((w) => ({ ...w, generatedConfig: config, step: 4 }));
      toast.success(t("vpn.configGenerated"));
    },
    onError: () => toast.error(t("vpn.configGenFailed")),
  });

  const parseMutation = useMutation({
    mutationFn: parseOpenVPNConfig,
    onSuccess: (resp) => {
      setParsedInfo(resp.data.data);
    },
    onError: () => toast.error(t("vpn.parseFailed")),
  });

  // Data
  const configs = configsQuery.data?.data ?? [];
  const status = statusQuery.data?.data;

  // Helpers
  function closeDialog() {
    setDialog("closed");
    setEditId(null);
    resetForm({ name: "", type: "wireguard", config: "" });
    setWizardName("");
    setImportName("");
    setWizard({ ...defaultWizard, params: { ...defaultWizard.params } });
    setImportText("");
    setParsedInfo(null);
    setQrTarget(null);
  }

  function openAdd() {
    closeDialog();
    setDialog("add");
  }

  function openEdit(cfg: VPNConfig) {
    setEditId(cfg.id);
    resetForm({ name: cfg.name, type: cfg.type, config: cfg.config });
    setDialog("edit");
  }

  function openWizard() {
    closeDialog();
    setDialog("wizard");
  }

  function openImport() {
    closeDialog();
    setDialog("import");
  }

  function openQR(cfg: VPNConfig) {
    setQrTarget(cfg);
    setDialog("qrcode");
  }

  const onSubmit = (data: VPNConfigFormData) => {
    if (editId !== null) {
      updateMutation.mutate({ id: editId, data });
    } else {
      createMutation.mutate(data);
    }
  };

  function handleDelete(id: number, name: string) {
    if (confirm(t("vpn.deleteConfirm").replace("{name}", name))) {
      deleteMutation.mutate(id);
    }
  }

  function handleConnect(id: number) {
    setConnectingId(id);
    connectMutation.mutate(id);
  }

  function handleDisconnect(id: number) {
    disconnectMutation.mutate(id);
  }

  function isCurrentVPN(cfgId: number): boolean {
    return status?.connected === true && status?.configId === cfgId;
  }

  // ─── Render ───

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

      {/* VPN Status Bar */}
      {status && (
        <Card>
          <CardContent className="flex items-center gap-4 py-3">
            <div
              className={
                "flex h-10 w-10 items-center justify-center rounded-xl " +
                (status.connected
                  ? "bg-green-500/10 text-green-400 shadow-sm shadow-green-500/10"
                  : "bg-muted text-muted-foreground")
              }
            >
              {status.connected ? <Wifi className="h-5 w-5" /> : <WifiOff className="h-5 w-5" />}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">
                  {status.connected ? t("vpn.connectedTo").replace("{name}", status.configName || "") : t("vpn.noConnection")}
                </span>
                {status.connected && (
                  <span className="rounded-full border border-green-500/20 bg-green-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-green-400">
                    {status.type}
                  </span>
                )}
              </div>
              {status.connected && (
                <div className="flex items-center gap-4 text-xs text-muted-foreground mt-0.5">
                  {status.connectedAt && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {t("vpn.connectedAt")}: {new Date(status.connectedAt).toLocaleString()}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <ArrowDownUp className="h-3 w-3" />
                    {t("vpn.trafficRx")}: {formatBytes(status.bytesRx)} / {t("vpn.trafficTx")}: {formatBytes(status.bytesTx)}
                  </span>
                  {status.publicIP && (
                    <span className="flex items-center gap-1">
                      <Globe className="h-3 w-3" />
                      {t("vpn.publicIP")}: {status.publicIP}
                    </span>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dialogs */}
      {dialog !== "closed" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={closeDialog}>
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border bg-background p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            {/* Add / Edit Config */}
            {(dialog === "add" || dialog === "edit") && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">
                    {dialog === "edit" ? t("vpn.editConfig") : t("vpn.newConfig")}
                  </h2>
                  <Button variant="ghost" size="icon" onClick={closeDialog}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <form onSubmit={handleFormSubmit(onSubmit)} className="space-y-4">
                  <div>
                    <Label>{t("vpn.configName")}</Label>
                    <Input
                      {...register("name")}
                      placeholder={t("vpn.configNamePlaceholder")}
                      className="mt-1"
                    />
                    {errors.name && (
                      <p className="mt-1 text-xs text-destructive">{errors.name.message}</p>
                    )}
                  </div>
                  <div>
                    <Label>{t("vpn.type")}</Label>
                    <select
                      {...register("type")}
                      className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors"
                    >
                      <option value="wireguard">{t("vpn.wireguard")}</option>
                      <option value="openvpn">{t("vpn.openvpn")}</option>
                    </select>
                    {errors.type && (
                      <p className="mt-1 text-xs text-destructive">{errors.type.message}</p>
                    )}
                  </div>
                  <div>
                    <Label>{t("vpn.config")}</Label>
                    <textarea
                      {...register("config")}
                      placeholder={t("vpn.configPlaceholder")}
                      rows={10}
                      className="mt-1 flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono"
                    />
                    {errors.config && (
                      <p className="mt-1 text-xs text-destructive">{errors.config.message}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                      {dialog === "edit" ? t("vpn.update") : t("vpn.create")}
                    </Button>
                    <Button variant="outline" type="button" onClick={closeDialog}>
                      {t("common.cancel")}
                    </Button>
                  </div>
                </form>
              </>
            )}

            {/* WireGuard Wizard */}
            {dialog === "wizard" && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">{t("vpn.wizard")}</h2>
                  <Button variant="ghost" size="icon" onClick={closeDialog}>
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
              </>
            )}

            {/* Import OpenVPN */}
            {dialog === "import" && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">{t("vpn.importOpenVPN")}</h2>
                  <Button variant="ghost" size="icon" onClick={closeDialog}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-4">
                  <div>
                    <Label>{t("vpn.importOpenVPNDesc")}</Label>
                    <textarea
                      value={importText}
                      onChange={(e) => {
                        setImportText(e.target.value);
                        setParsedInfo(null);
                      }}
                      placeholder={t("vpn.configPlaceholder")}
                      rows={10}
                      className="mt-1 flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono"
                    />
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (importText.trim()) parseMutation.mutate(importText);
                    }}
                    disabled={parseMutation.isPending || !importText.trim()}
                    className="w-full"
                  >
                    <Server className="mr-2 h-4 w-4" />
                    {parseMutation.isPending ? t("common.loading") : t("vpn.parsedInfo")}
                  </Button>
                  {parsedInfo && (
                    <Card>
                      <CardContent className="pt-4 space-y-2">
                        {parsedInfo.remote && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">{t("vpn.server")}</span>
                            <span className="font-mono">{parsedInfo.remote}</span>
                          </div>
                        )}
                        {parsedInfo.port && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">{t("vpn.port")}</span>
                            <span className="font-mono">{parsedInfo.port}</span>
                          </div>
                        )}
                        {parsedInfo.protocol && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">{t("vpn.protocol")}</span>
                            <span className="font-mono">{parsedInfo.protocol}</span>
                          </div>
                        )}
                        {parsedInfo.device && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">{t("vpn.device")}</span>
                            <span className="font-mono">{parsedInfo.device}</span>
                          </div>
                        )}
                        {parsedInfo.comment && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">{t("vpn.type")}</span>
                            <span>{parsedInfo.comment}</span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
                  <Separator />
                  <div>
                    <Label>{t("vpn.configName")}</Label>
                    <Input
                      value={importName}
                      onChange={(e) => setImportName(e.target.value)}
                      placeholder={t("vpn.configNamePlaceholder")}
                      className="mt-1"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <Button
                      onClick={() => {
                        createMutation.mutate({
                          name: importName || "OpenVPN",
                          type: "openvpn",
                          config: importText,
                        });
                      }}
                      disabled={createMutation.isPending || !importText.trim() || !importName}
                    >
                      {createMutation.isPending ? t("common.loading") : t("vpn.create")}
                    </Button>
                    <Button variant="outline" onClick={closeDialog}>
                      {t("common.cancel")}
                    </Button>
                  </div>
                </div>
              </>
            )}

            {/* QR Code Share */}
            {dialog === "qrcode" && qrTarget && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">{t("vpn.qrCode")}</h2>
                  <Button variant="ghost" size="icon" onClick={closeDialog}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">{t("vpn.qrCodeDesc")}</p>
                  <div className="flex justify-center">
                    <div className="rounded-xl border bg-white p-4">
                      <QRCodeSVG value={qrTarget.config} size={220} level="M" />
                    </div>
                  </div>
                  <p className="text-center text-xs text-muted-foreground">
                    {qrTarget.name} ({qrTarget.type})
                  </p>
                  <div className="flex justify-center">
                    <Button
                      variant="outline"
                      onClick={() => {
                        navigator.clipboard.writeText(qrTarget.config);
                        toast.success(t("vpn.copied"));
                      }}
                    >
                      <Copy className="mr-2 h-4 w-4" />
                      {t("vpn.copyConfig")}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Loading */}
      {configsQuery.isLoading && (
        <p className="text-sm text-muted-foreground">{t("vpn.loading")}</p>
      )}

      {/* Empty State */}
      {configs.length === 0 && !configsQuery.isLoading && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">{t("vpn.noConfigs")}</p>
            <p className="text-xs text-muted-foreground mt-1">{t("vpn.firstConfig")}</p>
          </CardContent>
        </Card>
      )}

      {/* Config List */}
      <div className="space-y-3">
        {configs.map((cfg) => (
          <Card key={cfg.id} className="border-border bg-card transition-all duration-200 hover:border-border/80">
            <CardContent className="flex items-center justify-between py-4">
              <div className="flex items-center gap-4">
                <div
                  className={
                    "flex h-10 w-10 items-center justify-center rounded-xl transition-all " +
                    (isCurrentVPN(cfg.id)
                      ? "bg-green-500/10 text-green-400 shadow-sm shadow-green-500/10"
                      : "bg-muted text-muted-foreground")
                  }
                >
                  <Shield className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{cfg.name}</p>
                    <span
                      className={
                        "rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider " +
                        (cfg.type === "wireguard"
                          ? "border border-blue-500/20 bg-blue-500/10 text-blue-400"
                          : "border border-orange-500/20 bg-orange-500/10 text-orange-400")
                      }
                    >
                      {cfg.type}
                    </span>
                    {isCurrentVPN(cfg.id) && (
                      <span className="rounded-full border border-green-500/20 bg-green-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-green-400">
                        {t("vpn.connected")}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("common.enabled")}: {cfg.enabled ? t("common.yes") : t("common.no")} &middot;{" "}
                    {new Date(cfg.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Connect / Disconnect */}
                {isCurrentVPN(cfg.id) ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDisconnect(cfg.id)}
                    disabled={disconnectMutation.isPending}
                    className="text-orange-500 border-orange-500/30 hover:bg-orange-500/10"
                  >
                    <WifiOff className="mr-1.5 h-3.5 w-3.5" />
                    {t("vpn.disconnect")}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleConnect(cfg.id)}
                    disabled={connectingId === cfg.id || (status?.connected === true)}
                    className="text-green-500 border-green-500/30 hover:bg-green-500/10"
                  >
                    <Wifi className="mr-1.5 h-3.5 w-3.5" />
                    {connectingId === cfg.id ? t("vpn.connecting") : t("vpn.connect")}
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => openQR(cfg)} className="h-8 w-8 p-0" title={t("vpn.qrCode")}>
                  <QrCode className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => openEdit(cfg)} className="h-8 w-8 p-0" title={t("common.edit")}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(cfg.id, cfg.name)}
                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                  title={t("common.delete")}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
