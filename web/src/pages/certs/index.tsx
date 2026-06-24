import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchCertificates, fetchCertStatus, requestLetsEncrypt,
  generateSelfSigned, deleteCertificate, renewCertificate, toggleAutoRenew,
} from "@/features/certs/api";
import type { Certificate } from "@/features/certs/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/stores/toast";
import { useTranslation } from "@/hooks/useTranslation";
import {
  ShieldCheck, Plus, Trash2, RefreshCw, Download,
  Lock, Globe, ToggleLeft, ToggleRight, X,
  FileKey, Clock, AlertTriangle,
} from "lucide-react";

type TabType = "letsencrypt" | "selfsigned";

export default function CertsPage() {
  const t = useTranslation();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("letsencrypt");
  const [leForm, setLeForm] = useState({ domain: "", email: "", autoRenew: true });
  const [ssForm, setSsForm] = useState({ domain: "", days: 365, autoRenew: false });
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  const certsQuery = useQuery({ queryKey: ["certs"], queryFn: fetchCertificates });
  const statusQuery = useQuery({ queryKey: ["certs-status"], queryFn: fetchCertStatus });

  const createLEMutation = useMutation({
    mutationFn: requestLetsEncrypt,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["certs"] });
      setShowForm(false);
      setLeForm({ domain: "", email: "", autoRenew: true });
      toast.success(t("certs.leCreated"));
    },
    onError: (err: Error) => toast.error(err.message || t("certs.createFailed")),
  });

  const createSSMutation = useMutation({
    mutationFn: generateSelfSigned,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["certs"] });
      setShowForm(false);
      setSsForm({ domain: "", days: 365, autoRenew: false });
      toast.success(t("certs.ssCreated"));
    },
    onError: (err: Error) => toast.error(err.message || t("certs.createFailed")),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCertificate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["certs"] });
      setConfirmDelete(null);
      toast.success(t("certs.deleted"));
    },
    onError: () => toast.error(t("certs.deleteFailed")),
  });

  const renewMutation = useMutation({
    mutationFn: renewCertificate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["certs"] });
      toast.success(t("certs.renewed"));
    },
    onError: (err: Error) => toast.error(err.message || t("certs.renewFailed")),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, autoRenew }: { id: number; autoRenew: boolean }) => toggleAutoRenew(id, autoRenew),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["certs"] });
      toast.success(t("certs.autoRenewToggled"));
    },
    onError: () => toast.error(t("certs.toggleFailed")),
  });

  const certs: Certificate[] = certsQuery.data?.data ?? [];
  const status = statusQuery.data?.data;

  function handleSubmitLE(e: React.FormEvent) {
    e.preventDefault();
    createLEMutation.mutate(leForm);
  }

  function handleSubmitSS(e: React.FormEvent) {
    e.preventDefault();
    createSSMutation.mutate(ssForm);
  }

  function getExpiryStatus(expiresAt: string): "expired" | "expiring" | "valid" {
    if (!expiresAt) return "valid";
    const expiry = new Date(expiresAt);
    const now = new Date();
    if (expiry < now) return "expired";
    const daysLeft = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    if (daysLeft <= 30) return "expiring";
    return "valid";
  }

  function formatExpiry(expiresAt: string): string {
    if (!expiresAt) return t("common.na");
    try {
      const expiry = new Date(expiresAt);
      const now = new Date();
      const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (daysLeft < 0) return t("certs.expired");
      if (daysLeft === 0) return t("certs.expiresToday");
      return `${expiry.toLocaleDateString()} (${t("certs.daysLeft").replace("{days}", String(daysLeft))})`;
    } catch {
      return expiresAt;
    }
  }

  function getDownloadUrl(id: number, format: string): string {
    return `/api/v1/certs/${id}/download?format=${format}`;
  }

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("certs.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("certs.subtitle")}</p>
        </div>
        <Button
          size="sm"
          onClick={() => { setShowForm(!showForm); setActiveTab("letsencrypt"); }}
        >
          <Plus className="mr-1.5 h-4 w-4" />
          {t("certs.addCert")}
        </Button>
      </div>

      {/* Status bar */}
      {status && (
        <Card className="border-border bg-muted/30">
          <CardContent className="flex items-center gap-3 py-3 px-4">
            <div className={"h-2.5 w-2.5 rounded-full " + (status.certbotInstalled ? "bg-green-400 shadow-sm shadow-green-400/50" : "bg-slate-400 shadow-sm shadow-slate-400/50")} />
            <span className="text-sm font-medium">Certbot</span>
            <span className="text-xs text-muted-foreground">
              {status.certbotInstalled ? t("certs.certbotInstalled") : t("certs.certbotNotInstalled")}
            </span>
            {status.certbotVersion && (
              <span className="ml-auto text-xs text-muted-foreground">{status.certbotVersion.trim()}</span>
            )}
          </CardContent>
        </Card>
      )}

      {/* Create form */}
      {showForm && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{t("certs.newCert")}</CardTitle>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setShowForm(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex gap-2 mt-2">
              <button
                className={"px-3 py-1.5 text-sm rounded-md transition-colors " + (activeTab === "letsencrypt" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80")}
                onClick={() => setActiveTab("letsencrypt")}
              >
                {t("certs.letsEncrypt")}
              </button>
              <button
                className={"px-3 py-1.5 text-sm rounded-md transition-colors " + (activeTab === "selfsigned" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80")}
                onClick={() => setActiveTab("selfsigned")}
              >
                {t("certs.selfSigned")}
              </button>
            </div>
          </CardHeader>
          <CardContent>
            {activeTab === "letsencrypt" ? (
              <form onSubmit={handleSubmitLE} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label>{t("certs.domain")}</Label>
                    <Input
                      value={leForm.domain}
                      onChange={(e) => setLeForm((p) => ({ ...p, domain: e.target.value }))}
                      placeholder="example.com"
                      required
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>{t("certs.email")}</Label>
                    <Input
                      type="email"
                      value={leForm.email}
                      onChange={(e) => setLeForm((p) => ({ ...p, email: e.target.value }))}
                      placeholder="admin@example.com"
                      required
                      className="mt-1"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="le-auto-renew"
                    checked={leForm.autoRenew}
                    onChange={(e) => setLeForm((p) => ({ ...p, autoRenew: e.target.checked }))}
                    className="h-4 w-4 rounded border-input"
                  />
                  <Label htmlFor="le-auto-renew" className="cursor-pointer">{t("certs.autoRenew")}</Label>
                </div>
                <p className="text-xs text-muted-foreground">{t("certs.leNotice")}</p>
                <div className="flex items-center gap-3">
                  <Button type="submit" disabled={createLEMutation.isPending}>
                    {createLEMutation.isPending ? t("certs.requesting") : t("certs.requestLE")}
                  </Button>
                  <Button variant="outline" type="button" onClick={() => setShowForm(false)}>
                    {t("common.cancel")}
                  </Button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleSubmitSS} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label>{t("certs.domain")}</Label>
                    <Input
                      value={ssForm.domain}
                      onChange={(e) => setSsForm((p) => ({ ...p, domain: e.target.value }))}
                      placeholder="example.local"
                      required
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>{t("certs.validDays")}</Label>
                    <Input
                      type="number"
                      value={ssForm.days}
                      onChange={(e) => setSsForm((p) => ({ ...p, days: parseInt(e.target.value) || 365 }))}
                      min={1}
                      max={3650}
                      className="mt-1"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="ss-auto-renew"
                    checked={ssForm.autoRenew}
                    onChange={(e) => setSsForm((p) => ({ ...p, autoRenew: e.target.checked }))}
                    className="h-4 w-4 rounded border-input"
                  />
                  <Label htmlFor="ss-auto-renew" className="cursor-pointer">{t("certs.autoRenew")}</Label>
                </div>
                <div className="flex items-center gap-3">
                  <Button type="submit" disabled={createSSMutation.isPending}>
                    {createSSMutation.isPending ? t("certs.generating") : t("certs.generateSS")}
                  </Button>
                  <Button variant="outline" type="button" onClick={() => setShowForm(false)}>
                    {t("common.cancel")}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      )}

      {certsQuery.isLoading && (
        <p className="text-sm text-muted-foreground">{t("certs.loading")}</p>
      )}

      {certs.length === 0 && !certsQuery.isLoading && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">{t("certs.noCerts")}</p>
            <p className="text-xs text-muted-foreground mt-1">{t("certs.firstCert")}</p>
          </CardContent>
        </Card>
      )}

      {/* Certificate list */}
      <div className="space-y-3">
        {certs.map((cert) => {
          const expiryStatus = getExpiryStatus(cert.expiresAt);
          return (
            <Card key={cert.id} className="border-border bg-card transition-all duration-200 hover:border-border/80">
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex items-center gap-4">
                  <div className={
                    "flex h-10 w-10 items-center justify-center rounded-xl transition-all " +
                    (expiryStatus === "expired" ? "bg-red-500/10 text-red-400 shadow-sm shadow-red-500/10" :
                     expiryStatus === "expiring" ? "bg-amber-500/10 text-amber-400 shadow-sm shadow-amber-500/10" :
                     "bg-green-500/10 text-green-400 shadow-sm shadow-green-500/10")
                  }>
                    {expiryStatus === "expired" ? (
                      <AlertTriangle className="h-5 w-5" />
                    ) : (
                      <ShieldCheck className="h-5 w-5" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                      <p className="font-medium">{cert.domain}</p>
                      <span className={"rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider " +
                        (cert.type === "letsencrypt"
                          ? "border-blue-500/20 bg-blue-500/10 text-blue-400"
                          : "border-slate-500/20 bg-slate-500/10 text-slate-400")
                      }>
                        {cert.type === "letsencrypt" ? "Let's Encrypt" : t("certs.selfSigned")}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <p className={"text-xs flex items-center gap-1 " +
                        (expiryStatus === "expired" ? "text-red-400" :
                         expiryStatus === "expiring" ? "text-amber-400" :
                         "text-muted-foreground")
                      }>
                        <Clock className="h-3 w-3" />
                        {formatExpiry(cert.expiresAt)}
                      </p>
                      {cert.autoRenew && (
                        <span className="text-xs text-green-400 flex items-center gap-1">
                          <RefreshCw className="h-3 w-3" />
                          {t("certs.autoRenewOn")}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {/* Auto-renew toggle */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    title={cert.autoRenew ? t("certs.disableAutoRenew") : t("certs.enableAutoRenew")}
                    onClick={() => toggleMutation.mutate({ id: cert.id, autoRenew: !cert.autoRenew })}
                  >
                    {cert.autoRenew
                      ? <ToggleRight className="h-5 w-5 text-green-600" />
                      : <ToggleLeft className="h-5 w-5 text-slate-400" />
                    }
                  </Button>

                  {/* Renew */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    title={t("certs.renew")}
                    onClick={() => renewMutation.mutate(cert.id)}
                    disabled={renewMutation.isPending}
                  >
                    <RefreshCw className={"h-4 w-4 " + (renewMutation.isPending ? "animate-spin" : "")} />
                  </Button>

                  {/* Download dropdown */}
                  <div className="relative group">
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title={t("certs.download")}>
                      <Download className="h-4 w-4" />
                    </Button>
                    <div className="absolute right-0 top-full mt-1 hidden group-hover:block z-10 bg-popover border border-border rounded-md shadow-lg py-1 min-w-[120px]">
                      <a
                        href={getDownloadUrl(cert.id, "pem")}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent transition-colors"
                        download
                      >
                        <FileKey className="h-3.5 w-3.5" />
                        PEM
                      </a>
                      <a
                        href={getDownloadUrl(cert.id, "key")}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent transition-colors"
                        download
                      >
                        <Lock className="h-3.5 w-3.5" />
                        KEY
                      </a>
                      <a
                        href={getDownloadUrl(cert.id, "p12")}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent transition-colors"
                        download
                      >
                        <ShieldCheck className="h-3.5 w-3.5" />
                        P12
                      </a>
                    </div>
                  </div>

                  {/* Delete */}
                  {confirmDelete === cert.id ? (
                    <div className="flex items-center gap-1 ml-1">
                      <span className="text-xs text-destructive">{t("common.confirm")}</span>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => deleteMutation.mutate(cert.id)}
                        disabled={deleteMutation.isPending}
                      >
                        {t("common.yes")}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => setConfirmDelete(null)}
                      >
                        {t("common.cancel")}
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      title={t("common.delete")}
                      onClick={() => setConfirmDelete(cert.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
