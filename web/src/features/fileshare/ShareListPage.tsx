import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listFileShares, deleteFileShare, getShareDownloadUrl, type FileShareLink } from "./api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/stores/toast";
import { useTranslation } from "@/hooks/useTranslation";
import {
  Link,
  Trash2,
  Copy,
  Check,
  Clock,
  Download,
  QrCode,
  ExternalLink,
} from "lucide-react";

export default function ShareListPage() {
  const t = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [qrToken, setQrToken] = useState<string | null>(null);

  const sharesQuery = useQuery({
    queryKey: ["fileshares"],
    queryFn: listFileShares,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteFileShare,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fileshares"] });
      toast.success(t("fileshare.deleted"));
    },
    onError: (err: Error) => {
      toast.error(err.message || t("fileshare.deleteFailed"));
    },
  });

  function handleCopy(share: FileShareLink) {
    const url = `${window.location.origin}${getShareDownloadUrl(share.token)}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedToken(share.token);
      toast.success(t("fileshare.linkCopied"));
      setTimeout(() => setCopiedToken(null), 2000);
    });
  }

  function handleDelete(share: FileShareLink) {
    if (confirm(t("fileshare.deleteConfirm").replace("{name}", share.fileName))) {
      deleteMutation.mutate(share.token);
    }
  }

  function isExpired(share: FileShareLink): boolean {
    if (!share.expiresAt) return false;
    return new Date(share.expiresAt) < new Date();
  }

  function isLimitReached(share: FileShareLink): boolean {
    return share.maxDownloads > 0 && share.downloadCount >= share.maxDownloads;
  }

  const shares = sharesQuery.data?.data ?? [];

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("fileshare.listTitle")}</h1>
          <p className="text-muted-foreground">{t("fileshare.listSubtitle")}</p>
        </div>
      </div>

      {sharesQuery.isLoading && <p className="text-sm text-muted-foreground">{t("common.loading")}</p>}
      {sharesQuery.isError && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">{t("fileshare.loadFailed")}</p>
          </CardContent>
        </Card>
      )}
      {shares.length === 0 && !sharesQuery.isLoading && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">{t("fileshare.noShares")}</p>
            <p className="text-xs text-muted-foreground mt-1">{t("fileshare.firstShare")}</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {shares.map((share) => {
          const expired = isExpired(share);
          const limitReached = isLimitReached(share);
          const inactive = expired || limitReached;

          return (
            <Card key={share.id} className={"border-border bg-card transition-all duration-200 hover:border-border/80" + (inactive ? " opacity-60" : "")}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={"flex h-10 w-10 items-center justify-center rounded-xl transition-all " + (inactive ? "bg-muted text-muted-foreground" : "bg-cyan-500/10 text-cyan-400 shadow-sm shadow-cyan-500/10")}>
                      <Link className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{share.fileName}</p>
                        {expired && (
                          <span className="rounded-full border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-red-400">
                            {t("fileshare.expired")}
                          </span>
                        )}
                        {limitReached && !expired && (
                          <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-amber-400">
                            {t("fileshare.limitReached")}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground font-mono truncate max-w-md">{share.filePath}</p>
                      <div className="flex items-center gap-4 mt-1">
                        {share.expiresAt && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {t("fileshare.expires")}: {new Date(share.expiresAt).toLocaleString()}
                          </span>
                        )}
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Download className="h-3 w-3" />
                          {share.downloadCount}{share.maxDownloads > 0 ? ` / ${share.maxDownloads}` : ""} {t("fileshare.downloads")}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setQrToken(qrToken === share.token ? null : share.token)}
                      className="h-8 w-8 p-0"
                      title={t("fileshare.showQR")}
                    >
                      <QrCode className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.open(getShareDownloadUrl(share.token), "_blank")}
                      className="h-8 w-8 p-0"
                      title={t("fileshare.openLink")}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopy(share)}
                      className="h-8 w-8 p-0"
                      title={t("fileshare.copyLink")}
                    >
                      {copiedToken === share.token ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(share)}
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      title={t("common.delete")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* QR Code inline display */}
                {qrToken === share.token && (
                  <div className="mt-3 flex justify-center">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(`${window.location.origin}${getShareDownloadUrl(share.token)}`)}`}
                      alt="QR Code"
                      className="rounded-lg border"
                      width={180}
                      height={180}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
