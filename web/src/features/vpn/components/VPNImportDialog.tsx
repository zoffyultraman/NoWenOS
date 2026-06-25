import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useTranslation } from "@/hooks/useTranslation";
import type { OpenVPNInfo } from "@/features/vpn/api";
import { X, Server } from "lucide-react";

interface VPNImportDialogProps {
  importText: string;
  setImportText: (text: string) => void;
  importName: string;
  setImportName: (name: string) => void;
  parsedInfo: OpenVPNInfo | null;
  isParsePending: boolean;
  isCreatePending: boolean;
  onParse: () => void;
  onCreate: () => void;
  onClose: () => void;
}

export function VPNImportDialog({
  importText, setImportText, importName, setImportName,
  parsedInfo, isParsePending, isCreatePending,
  onParse, onCreate, onClose,
}: VPNImportDialogProps) {
  const t = useTranslation();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border bg-background p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{t("vpn.importOpenVPN")}</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
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
              }}
              placeholder={t("vpn.configPlaceholder")}
              rows={10}
              className="mt-1 flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono"
            />
          </div>
          <Button
            variant="outline"
            onClick={onParse}
            disabled={isParsePending || !importText.trim()}
            className="w-full"
          >
            <Server className="mr-2 h-4 w-4" />
            {isParsePending ? t("common.loading") : t("vpn.parsedInfo")}
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
              onClick={onCreate}
              disabled={isCreatePending || !importText.trim() || !importName}
            >
              {isCreatePending ? t("common.loading") : t("vpn.create")}
            </Button>
            <Button variant="outline" onClick={onClose}>
              {t("common.cancel")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
