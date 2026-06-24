import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Shield,
  ShieldCheck,
  ShieldOff,
  Copy,
  Download,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Eye,
  EyeOff,
} from "lucide-react";
import { useToast } from "@/stores/toast";
import { useTranslation } from "@/hooks/useTranslation";
import {
  get2FAStatus,
  enable2FA,
  verify2FA,
  disable2FA,
  get2FASetup,
} from "@/features/twofa/api";

type SetupStep = "idle" | "qr" | "verify" | "backup" | "done";

export default function TwoFactorCard() {
  const toast = useToast();
  const t = useTranslation();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<SetupStep>("idle");
  const [otpUri, setOtpUri] = useState("");
  const [secret, setSecret] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [verifyCode, setVerifyCode] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [showDisableDialog, setShowDisableDialog] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  const statusQuery = useQuery({
    queryKey: ["2fa-status"],
    queryFn: get2FAStatus,
  });

  const isEnabled = statusQuery.data?.data?.enabled ?? false;

  const enableMutation = useMutation({
    mutationFn: enable2FA,
    onSuccess: (resp) => {
      setOtpUri(resp.data.otpUri);
      setSecret(resp.data.secret);
      setBackupCodes(resp.data.backupCodes);
      setStep("qr");
    },
    onError: (err: Error) => {
      toast.error(err.message || t("2fa.enableFailed"));
    },
  });

  const verifyMutation = useMutation({
    mutationFn: verify2FA,
    onSuccess: () => {
      setStep("backup");
    },
    onError: (err: Error) => {
      toast.error(err.message || t("2fa.verifyFailed"));
    },
  });

  const disableMutation = useMutation({
    mutationFn: disable2FA,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["2fa-status"] });
      setShowDisableDialog(false);
      setDisableCode("");
      setStep("idle");
      toast.success(t("2fa.disabledSuccess"));
    },
    onError: (err: Error) => {
      toast.error(err.message || t("2fa.disableFailed"));
    },
  });

  // Check for pending setup on mount
  useEffect(() => {
    if (!isEnabled && statusQuery.data) {
      get2FASetup()
        .then((resp) => {
          if (resp.data) {
            setOtpUri(resp.data.otpUri);
            setSecret(resp.data.secret);
            setBackupCodes(resp.data.backupCodes);
            setStep("qr");
          }
        })
        .catch(() => {
          // No pending setup
        });
    }
  }, [isEnabled, statusQuery.data]);

  function handleEnable() {
    enableMutation.mutate();
  }

  function handleVerify() {
    if (verifyCode.length !== 6) {
      toast.error(t("2fa.codeLength"));
      return;
    }
    verifyMutation.mutate(verifyCode);
  }

  function handleDisable() {
    if (!disableCode) {
      toast.error(t("2fa.enterCode"));
      return;
    }
    disableMutation.mutate(disableCode);
  }

  function handleFinishSetup() {
    queryClient.invalidateQueries({ queryKey: ["2fa-status"] });
    setStep("done");
    setVerifyCode("");
    toast.success(t("2fa.enabledSuccess"));
  }

  function copySecret() {
    navigator.clipboard.writeText(secret);
    toast.success(t("2fa.secretCopied"));
  }

  function copyBackupCodes() {
    navigator.clipboard.writeText(backupCodes.join("\n"));
    toast.success(t("2fa.codesCopied"));
  }

  function downloadBackupCodes() {
    const content = `NoWenOS 2FA Backup Codes\n${"=".repeat(30)}\n\n${backupCodes.join("\n")}\n\nKeep these codes safe. Each code can only be used once.`;
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "nowenos-2fa-backup-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t("2fa.codesDownloaded"));
  }

  // QR code URL using a free API
  const qrCodeUrl = otpUri
    ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpUri)}`
    : "";

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
            {isEnabled ? (
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
            ) : (
              <Shield className="h-4 w-4 text-emerald-400" />
            )}
          </div>
          {t("2fa.title")}
        </CardTitle>
        <CardDescription>{t("2fa.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status */}
        {isEnabled && step !== "backup" && (
          <div className="flex items-center justify-between rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-400" />
              <span className="text-sm font-medium text-emerald-400">
                {t("2fa.statusEnabled")}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDisableDialog(true)}
              className="border-danger/30 text-danger hover:bg-danger/10"
            >
              <ShieldOff className="mr-1.5 h-3.5 w-3.5" />
              {t("2fa.disable")}
            </Button>
          </div>
        )}

        {/* Step: Idle - Enable button */}
        {step === "idle" && !isEnabled && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {t("2fa.enableDescription")}
            </p>
            <Button
              onClick={handleEnable}
              disabled={enableMutation.isPending}
              className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/20 hover:from-emerald-400 hover:to-emerald-500 transition-all"
            >
              {enableMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Shield className="mr-2 h-4 w-4" />
              )}
              {enableMutation.isPending ? t("2fa.enabling") : t("2fa.enable")}
            </Button>
          </div>
        )}

        {/* Step: QR Code */}
        {step === "qr" && (
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <p className="mb-3 text-sm text-muted-foreground">
                {t("2fa.scanQR")}
              </p>
              <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
                {/* QR Code */}
                <div className="flex-shrink-0 rounded-lg border border-border bg-white p-2">
                  {qrCodeUrl ? (
                    <img
                      src={qrCodeUrl}
                      alt="2FA QR Code"
                      width={200}
                      height={200}
                      className="block"
                    />
                  ) : (
                    <div className="flex h-[200px] w-[200px] items-center justify-center">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  )}
                </div>

                {/* Manual entry */}
                <div className="flex-1 space-y-3">
                  <div>
                    <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      {t("2fa.manualEntry")}
                    </Label>
                    <div className="mt-1 flex items-center gap-2">
                      <code className="flex-1 rounded-md bg-muted px-3 py-2 text-sm font-mono break-all">
                        {showSecret ? secret : "••••••••••••••••"}
                      </code>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setShowSecret(!showSecret)}
                        className="h-8 w-8 shrink-0"
                      >
                        {showSecret ? (
                          <EyeOff className="h-3.5 w-3.5" />
                        ) : (
                          <Eye className="h-3.5 w-3.5" />
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={copySecret}
                        className="h-8 w-8 shrink-0"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("2fa.manualEntryHelp")}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                onClick={() => setStep("verify")}
                className="bg-gradient-to-r from-cyan-500 to-cyan-600 text-white"
              >
                {t("2fa.continue")}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setStep("idle");
                  setOtpUri("");
                  setSecret("");
                }}
              >
                {t("common.cancel")}
              </Button>
            </div>
          </div>
        )}

        {/* Step: Verify TOTP code */}
        {step === "verify" && (
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <p className="mb-3 text-sm text-muted-foreground">
                {t("2fa.enterCodeFromApp")}
              </p>
              <div className="flex items-center gap-2">
                <Input
                  value={verifyCode}
                  onChange={(e) =>
                    setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  placeholder="000000"
                  maxLength={6}
                  className="h-11 w-40 text-center text-lg font-mono tracking-[0.3em] bg-muted/50 border-border"
                  autoFocus
                />
                <Button
                  onClick={handleVerify}
                  disabled={verifyCode.length !== 6 || verifyMutation.isPending}
                  className="bg-gradient-to-r from-cyan-500 to-cyan-600 text-white"
                >
                  {verifyMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    t("2fa.verify")
                  )}
                </Button>
              </div>
            </div>
            <Button variant="outline" onClick={() => setStep("qr")}>
              {t("common.cancel")}
            </Button>
          </div>
        )}

        {/* Step: Backup codes */}
        {step === "backup" && (
          <div className="space-y-4">
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-400" />
                <div>
                  <p className="text-sm font-medium text-amber-400">
                    {t("2fa.saveBackupCodes")}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("2fa.backupCodesWarning")}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <div className="grid grid-cols-2 gap-2">
                {backupCodes.map((code, i) => (
                  <div
                    key={i}
                    className="rounded-md bg-background px-3 py-1.5 text-sm font-mono"
                  >
                    {code}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={copyBackupCodes}
                className="flex-1"
              >
                <Copy className="mr-2 h-4 w-4" />
                {t("2fa.copyCodes")}
              </Button>
              <Button
                variant="outline"
                onClick={downloadBackupCodes}
                className="flex-1"
              >
                <Download className="mr-2 h-4 w-4" />
                {t("2fa.downloadCodes")}
              </Button>
            </div>

            <Button
              onClick={handleFinishSetup}
              className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 text-white"
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              {t("2fa.finishSetup")}
            </Button>
          </div>
        )}

        {/* Step: Done */}
        {step === "done" && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
            <CheckCircle className="h-4 w-4 text-emerald-400" />
            <span className="text-sm text-emerald-400">
              {t("2fa.setupComplete")}
            </span>
          </div>
        )}

        {/* Disable Dialog */}
        {showDisableDialog && (
          <div className="rounded-lg border border-danger/20 bg-danger/5 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-danger" />
              <p className="text-sm font-medium text-danger">
                {t("2fa.disableConfirm")}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("2fa.disableDescription")}
            </p>
            <div className="flex items-center gap-2">
              <Input
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value)}
                placeholder={t("2fa.codeOrBackup")}
                className="h-9 bg-muted/50 border-border"
              />
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDisable}
                disabled={disableMutation.isPending}
              >
                {disableMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  t("common.confirm")
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowDisableDialog(false);
                  setDisableCode("");
                }}
              >
                {t("common.cancel")}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
