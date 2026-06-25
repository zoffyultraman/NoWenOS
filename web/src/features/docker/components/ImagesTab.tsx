import { useState } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchImages, pullImage, removeImage } from "@/features/docker/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/stores/toast";
import { Download, Trash2 } from "lucide-react";

export function ImagesTab() {
  const t = useTranslation();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [pullName, setPullName] = useState("");
  const [removeImageConfirm, setRemoveImageConfirm] = useState<{ id: string; name: string } | null>(null);

  const imagesQuery = useQuery({ queryKey: ["images"], queryFn: fetchImages });

  const pullMutation = useMutation({
    mutationFn: () => pullImage(pullName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["images"] });
      toast.success(t("docker.pullSuccess"));
      setPullName("");
    },
    onError: () => toast.error(t("docker.pullFailed")),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => removeImage(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["images"] });
      toast.success(t("docker.imageRemoved"));
    },
    onError: () => toast.error(t("docker.removeFailed")),
  });

  const images = imagesQuery.data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          placeholder={t("docker.pullPlaceholder")}
          value={pullName}
          onChange={(e) => setPullName(e.target.value)}
          className="sm:max-w-sm"
        />
        <Button onClick={() => pullMutation.mutate()} disabled={!pullName || pullMutation.isPending} className="flex-shrink-0">
          <Download className="mr-2 h-4 w-4" /> {t("docker.pull")}
        </Button>
      </div>

      {imagesQuery.isError && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">{t("docker.failedImages")}</p>
          </CardContent>
        </Card>
      )}

      {images.length === 0 && !imagesQuery.isLoading && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">{t("docker.noImages")}</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {images.map((image) => (
          <Card key={image.id}>
            <CardContent className="flex items-center justify-between gap-3 py-4">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{image.repository}:{image.tag}</p>
                <p className="text-xs text-muted-foreground truncate">{image.id} | {image.size} | {image.created}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setRemoveImageConfirm({ id: image.id, name: `${image.repository}:${image.tag}` })} disabled={removeMutation.isPending} className="h-8 w-8 p-0">
                <Trash2 className="h-4 w-4 text-red-600" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
      <ConfirmDialog
        open={!!removeImageConfirm}
        onClose={() => setRemoveImageConfirm(null)}
        onConfirm={() => {
          if (removeImageConfirm) {
            removeMutation.mutate(removeImageConfirm.id);
            setRemoveImageConfirm(null);
          }
        }}
        title={t("common.delete")}
        message={`${t("common.delete")} "${removeImageConfirm?.name ?? ""}"?`}
        loading={removeMutation.isPending}
      />
    </div>
  );
}
