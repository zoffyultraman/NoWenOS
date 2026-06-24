import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { createFileShare, getShareDownloadUrl, type FileShareLink } from "./api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/stores/toast";
import { useTranslation } from "@/hooks/useTranslation";
import { X, Copy, Check, Link, Clock, Download, QrCode } from "lucide-react";

interface ShareDialogProps {
  filePath: string;
  fileName: string;
  onClose: () => void;
}

export function ShareDialog({ filePath, fileName, onClose }: ShareDialogProps) {
  const t = useTranslation();
  const toast = useToast();
  const [expiresHours, setExpiresHours] = useState(0);
  const [maxDownloads, setMaxDownloads] = useState(0);
  const [created, setCreated] = useState<FileShareLink | null>(null);
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);

  const createMutation = useMutation({
    mutationFn: createFileShare,
    onSuccess: (res) => {
      setCreated(res.data);
      toast.success(t("fileshare.created"));
    },
    onError: (err: Error) => {
      toast.error(err.message || t("fileshare.createFailed"));
    },
  });

  function handleCreate() {
    createMutation.mutate({
      filePath,
      expiresHours: expiresHours > 0 ? expiresHours : undefined,
      maxDownloads: maxDownloads > 0 ? maxDownloads : undefined,
    });
  }

  function handleCopy() {
    if (!created) return;
    const url = `${window.location.origin}${getShareDownloadUrl(created.token)}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      toast.success(t("fileshare.linkCopied"));
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function getShareUrl(): string {
    if (!created) return "";
    return `${window.location.origin}${getShareDownloadUrl(created.token)}`;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <Card className="w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-lg">{t("fileshare.title")}</CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* File info */}
          <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2">
            <Link className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium truncate">{fileName}</span>
          </div>

          {!created ? (
            <>
              {/* Expiry setting */}
              <div className="space-y-2">
                <Label htmlFor="expires-hours" className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  {t("fileshare.expiresIn")}
                </Label>
                <select
                  id="expires-hours"
                  value={expiresHours}
                  onChange={(e) => setExpiresHours(Number(e.target.value))}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value={0}>{t("fileshare.never")}</option>
                  <option value={1}>{t("fileshare.1hour")}</option>
                  <option value={6}>{t("fileshare.6hours")}</option>
                  <option value={24}>{t("fileshare.1day")}</option>
                  <option value={72}>{t("fileshare.3days")}</option>
                  <option value={168}>{t("fileshare.7days")}</option>
                  <option value={720}>{t("fileshare.30days")}</option>
                </select>
              </div>

              {/* Download limit */}
              <div className="space-y-2">
                <Label htmlFor="max-downloads" className="flex items-center gap-1.5">
                  <Download className="h-3.5 w-3.5" />
                  {t("fileshare.downloadLimit")}
                </Label>
                <Input
                  id="max-downloads"
                  type="number"
                  min={0}
                  value={maxDownloads}
                  onChange={(e) => setMaxDownloads(Number(e.target.value))}
                  placeholder={t("fileshare.unlimitedPlaceholder")}
                />
                <p className="text-xs text-muted-foreground">{t("fileshare.unlimitedHint")}</p>
              </div>

              {/* Create button */}
              <div className="flex items-center gap-3 pt-2">
                <Button onClick={handleCreate} disabled={createMutation.isPending} className="flex-1">
                  {createMutation.isPending ? t("fileshare.creating") : t("fileshare.createLink")}
                </Button>
                <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
              </div>
            </>
          ) : (
            <>
              {/* Share link result */}
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>{t("fileshare.shareLink")}</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      readOnly
                      value={getShareUrl()}
                      className="font-mono text-xs"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopy}
                      className="shrink-0"
                    >
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                {/* Share details */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {created.expiresAt && (
                    <div className="rounded-lg bg-muted/50 px-3 py-2">
                      <span className="text-muted-foreground">{t("fileshare.expires")}</span>
                      <p className="font-medium">{new Date(created.expiresAt).toLocaleString()}</p>
                    </div>
                  )}
                  {created.maxDownloads > 0 && (
                    <div className="rounded-lg bg-muted/50 px-3 py-2">
                      <span className="text-muted-foreground">{t("fileshare.downloads")}</span>
                      <p className="font-medium">{created.downloadCount} / {created.maxDownloads}</p>
                    </div>
                  )}
                </div>

                {/* QR Code */}
                <div className="pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowQR(!showQR)}
                    className="w-full"
                  >
                    <QrCode className="mr-2 h-4 w-4" />
                    {showQR ? t("fileshare.hideQR") : t("fileshare.showQR")}
                  </Button>
                  {showQR && (
                    <div className="mt-3 flex justify-center">
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(getShareUrl())}`}
                        alt="QR Code"
                        className="rounded-lg border"
                        width={200}
                        height={200}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Close button */}
              <div className="pt-2">
                <Button variant="outline" onClick={onClose} className="w-full">{t("common.close")}</Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
