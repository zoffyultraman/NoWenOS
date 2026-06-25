import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";
import { useToast } from "@/stores/toast";
import type { VPNConfig } from "@/features/vpn/api";
import { X, Copy } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

interface VPNQRDialogProps {
  qrTarget: VPNConfig;
  onClose: () => void;
}

export function VPNQRDialog({ qrTarget, onClose }: VPNQRDialogProps) {
  const t = useTranslation();
  const toast = useToast();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border bg-background p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{t("vpn.qrCode")}</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
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
      </div>
    </div>
  );
}
