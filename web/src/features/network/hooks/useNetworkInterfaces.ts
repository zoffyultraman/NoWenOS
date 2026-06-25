import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchInterfaces,
  bringUpInterface,
  bringDownInterface,
} from "@/features/network/api";
import { useToast } from "@/stores/toast";
import { useTranslation } from "@/hooks/useTranslation";

export function useNetworkInterfaces() {
  const t = useTranslation();
  const queryClient = useQueryClient();
  const toast = useToast();

  const ifacesQuery = useQuery({
    queryKey: ["network-interfaces"],
    queryFn: fetchInterfaces,
    refetchInterval: 5000,
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

  const interfaces = ifacesQuery.data?.data ?? [];

  return {
    interfaces,
    ifacesQuery,
    upMutation,
    downMutation,
  };
}
