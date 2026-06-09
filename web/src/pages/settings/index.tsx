import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchSettings, updateSettings } from "@/features/settings/api";
import type { SettingsData } from "@/features/settings/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, Settings } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/stores/toast";
import { useTranslation } from "@/hooks/useTranslation";

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const settingsQuery = useQuery({ queryKey: ["settings"], queryFn: fetchSettings });
  const toast = useToast();
  const t = useTranslation();

  const [form, setForm] = useState<SettingsData>({
    hostname: "", httpPort: 8080, logLevel: "info", autoUpdate: false, maxUpload: 1024,
  });

  // Sync form with fetched data
  const serverSettings = settingsQuery.data?.data;
  if (serverSettings && form.hostname === "" && serverSettings.hostname !== "") {
    setForm(serverSettings);
  }

  const updateMutation = useMutation({
    mutationFn: updateSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      toast.success(t("settings.saved"));
    },
    onError: () => {
      toast.error(t("settings.saveFailed"));
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    updateMutation.mutate(form);
  }

  function handleChange(field: keyof SettingsData, value: string | number | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("settings.title")}</h1>
        <p className="text-muted-foreground">{t("settings.subtitle")}</p>
      </div>

      {settingsQuery.isLoading && <p className="text-sm text-muted-foreground">{t("settings.loading")}</p>}

      {settingsQuery.isError && (
        <Card className="border-destructive">
          <CardContent className="pt-6"><p className="text-sm text-destructive">{t("settings.failed")}</p></CardContent>
        </Card>
      )}

      {settingsQuery.data && (
        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                {t("settings.systemSettings")}
              </CardTitle>
              <CardDescription>{t("settings.general")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="hostname">{t("settings.hostname")}</Label>
                  <Input id="hostname" value={form.hostname} onChange={(e) => handleChange("hostname", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="httpPort">{t("settings.httpPort")}</Label>
                  <Input id="httpPort" type="number" value={form.httpPort} onChange={(e) => handleChange("httpPort", Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="logLevel">{t("settings.logLevel")}</Label>
                  <select id="logLevel" value={form.logLevel} onChange={(e) => handleChange("logLevel", e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                    <option value="debug">{t("settings.debug")}</option>
                    <option value="info">{t("settings.info")}</option>
                    <option value="warn">{t("settings.warn")}</option>
                    <option value="error">{t("settings.error")}</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxUpload">{t("settings.maxUpload")}</Label>
                  <Input id="maxUpload" type="number" value={form.maxUpload} onChange={(e) => handleChange("maxUpload", Number(e.target.value))} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input id="autoUpdate" type="checkbox" checked={form.autoUpdate} onChange={(e) => handleChange("autoUpdate", e.target.checked)} className="h-4 w-4 rounded border" />
                <Label htmlFor="autoUpdate">{t("settings.autoUpdate")}</Label>
              </div>
              <div className="flex items-center gap-3">
                <Button type="submit" disabled={updateMutation.isPending}>
                  <Save className="mr-2 h-4 w-4" />
                  {updateMutation.isPending ? t("settings.saving") : t("settings.save")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      )}
    </div>
  );
}

