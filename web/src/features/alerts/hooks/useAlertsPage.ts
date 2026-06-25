import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchAlertRules,
  createAlertRule,
  fetchNotificationChannels,
  createNotificationChannel,
  deleteNotificationChannel,
  toggleNotificationChannel,
  testNotificationChannel,
  linkRuleChannels,
  fetchRuleChannels,
  toggleAlertRule,
  deleteAlertRule,
  fetchAlertEvents,
  markAlertsSeen,
  clearAlertEvents,
} from "@/features/alerts/api";
import type { CreateRuleRequest, CreateChannelRequest } from "@/features/alerts/api";
import { useToast } from "@/stores/toast";
import { useTranslation } from "@/hooks/useTranslation";

export function useAlertsPage() {
  const t = useTranslation();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreateRuleRequest>({
    name: "",
    metric: "cpu",
    operator: "gt",
    threshold: 80,
  });
  const [showChannelForm, setShowChannelForm] = useState(false);
  const [channelForm, setChannelForm] = useState<CreateChannelRequest>({ name: "", type: "webhook", config: "" });
  const [channelTab, setChannelTab] = useState(false);
  const [linkRuleId, setLinkRuleId] = useState<number | null>(null);
  const [selectedChannelIds, setSelectedChannelIds] = useState<number[]>([]);
  const [deleteRuleConfirm, setDeleteRuleConfirm] = useState<{ id: number; name: string } | null>(null);
  const [deleteChannelConfirm, setDeleteChannelConfirm] = useState<{ id: number; name: string } | null>(null);

  // Queries
  const channelsQuery = useQuery({ queryKey: ["notification-channels"], queryFn: fetchNotificationChannels });
  const ruleChannelsQuery = useQuery({
    queryKey: ["rule-channels", linkRuleId],
    queryFn: () => fetchRuleChannels(linkRuleId!),
    enabled: linkRuleId !== null,
  });
  const rulesQuery = useQuery({ queryKey: ["alert-rules"], queryFn: fetchAlertRules });
  const eventsQuery = useQuery({
    queryKey: ["alert-events"],
    queryFn: () => fetchAlertEvents(100),
    refetchInterval: 15000,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: createAlertRule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alert-rules"] });
      setShowForm(false);
      setForm({ name: "", metric: "cpu", operator: "gt", threshold: 80 });
      toast.success(t("alerts.ruleCreated"));
    },
    onError: (err: Error) => toast.error(err.message || t("alerts.createFailed")),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) => toggleAlertRule(id, enabled),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["alert-rules"] }),
  });

  const deleteRuleMutation = useMutation({
    mutationFn: deleteAlertRule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alert-rules"] });
      queryClient.invalidateQueries({ queryKey: ["alert-events"] });
      toast.success(t("alerts.ruleDeleted"));
    },
    onError: (err: Error) => toast.error(err.message || t("alerts.deleteFailed")),
  });

  const markSeenMutation = useMutation({
    mutationFn: markAlertsSeen,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["alert-events"] }),
  });

  const createChannelMutation = useMutation({
    mutationFn: createNotificationChannel,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-channels"] });
      setShowChannelForm(false);
      setChannelForm({ name: "", type: "webhook", config: "" });
      toast.success(t("alerts.channelCreated"));
    },
    onError: (err: Error) => toast.error(err.message || t("alerts.channelCreateFailed")),
  });

  const deleteChannelMutation = useMutation({
    mutationFn: deleteNotificationChannel,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-channels"] });
      toast.success(t("alerts.channelDeleted"));
    },
  });

  const toggleChannelMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) => toggleNotificationChannel(id, enabled),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notification-channels"] }),
  });

  const clearEventsMutation = useMutation({
    mutationFn: clearAlertEvents,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alert-events"] });
      toast.success(t("alerts.historyCleared"));
    },
  });

  const linkChannelsMutation = useMutation({
    mutationFn: ({ ruleId, channelIds }: { ruleId: number; channelIds: number[] }) => linkRuleChannels(ruleId, channelIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rule-channels"] });
      setLinkRuleId(null);
      toast.success(t("alerts.channelsLinked"));
    },
    onError: (err: Error) => toast.error(err.message || t("alerts.linkFailed")),
  });

  const testChannelMutation = useMutation({
    mutationFn: testNotificationChannel,
    onSuccess: () => toast.success(t("alerts.testSent")),
    onError: (err: Error) => toast.error(err.message || t("alerts.testFailed")),
  });

  // Data
  const channels = channelsQuery.data?.data ?? [];
  const rules = rulesQuery.data?.data ?? [];
  const events = eventsQuery.data?.data?.events ?? [];
  const unseen = eventsQuery.data?.data?.unseen ?? 0;
  const ruleChannelIds = ruleChannelsQuery.data?.data ?? [];

  useEffect(() => {
    if (linkRuleId !== null && ruleChannelsQuery.isSuccess) {
      setSelectedChannelIds(ruleChannelIds);
    }
  }, [linkRuleId, ruleChannelsQuery.isSuccess]);

  function openLinkDialog(ruleId: number) {
    setLinkRuleId(ruleId);
  }

  function toggleChannelSelection(chId: number) {
    setSelectedChannelIds((prev) =>
      prev.includes(chId) ? prev.filter((id) => id !== chId) : [...prev, chId]
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    createMutation.mutate(form);
  }

  return {
    // State
    showForm, setShowForm,
    form, setForm,
    showChannelForm, setShowChannelForm,
    channelForm, setChannelForm,
    channelTab, setChannelTab,
    linkRuleId, setLinkRuleId,
    selectedChannelIds,
    deleteRuleConfirm, setDeleteRuleConfirm,
    deleteChannelConfirm, setDeleteChannelConfirm,
    // Data
    channels, rules, events, unseen, ruleChannelIds,
    // Queries
    channelsQuery, rulesQuery, eventsQuery, ruleChannelsQuery,
    // Mutations
    createMutation, toggleMutation, deleteRuleMutation,
    markSeenMutation, createChannelMutation, deleteChannelMutation,
    toggleChannelMutation, clearEventsMutation,
    linkChannelsMutation, testChannelMutation,
    // Handlers
    openLinkDialog, toggleChannelSelection, handleSubmit,
  };
}
