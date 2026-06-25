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
import type { VPNConfig, WireGuardKeyPair, WireGuardConfigParams, OpenVPNInfo } from "@/features/vpn/api";
import { useToast } from "@/stores/toast";
import { useTranslation } from "@/hooks/useTranslation";

export type DialogMode = "closed" | "add" | "edit" | "wizard" | "import" | "qrcode";

export interface WizardState {
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

export function useVPNForm() {
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

  return {
    // State
    dialog, setDialog,
    editId,
    wizardName, setWizardName,
    importName, setImportName,
    wizard, setWizard,
    importText, setImportText,
    parsedInfo,
    qrTarget,
    connectingId,
    // Form
    register, handleFormSubmit, errors,
    // Queries
    configsQuery, statusQuery,
    configs, status,
    // Mutations
    createMutation, updateMutation, deleteMutation,
    connectMutation, disconnectMutation,
    genKeysMutation, genConfigMutation, parseMutation,
    // Handlers
    closeDialog, openAdd, openEdit, openWizard, openImport, openQR,
    onSubmit, handleDelete, handleConnect, handleDisconnect, isCurrentVPN,
  };
}
