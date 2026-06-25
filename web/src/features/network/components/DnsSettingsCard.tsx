import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslation } from "@/hooks/useTranslation";
import type { DNSConfig } from "@/features/network/api";
import { Save, Plus, Trash2, Server } from "lucide-react";

interface DnsSettingsCardProps {
  dnsForm: DNSConfig;
  onDnsFormChange: React.Dispatch<React.SetStateAction<DNSConfig>>;
  newDnsServer: string;
  onNewDnsServerChange: (value: string) => void;
  onAddDnsServer: () => void;
  onRemoveDnsServer: (index: number) => void;
  onSubmit: () => void;
  isPending: boolean;
}

export function DnsSettingsCard({
  dnsForm,
  onDnsFormChange,
  newDnsServer,
  onNewDnsServerChange,
  onAddDnsServer,
  onRemoveDnsServer,
  onSubmit,
  isPending,
}: DnsSettingsCardProps) {
  const t = useTranslation();

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10">
            <Server className="h-4 w-4 text-purple-400" />
          </div>
          {t("network.dnsTitle")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="space-y-4">
          {/* DNS Servers */}
          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {t("network.dnsServers")}
            </Label>
            <div className="space-y-2">
              {dnsForm.servers.map((server, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    value={server}
                    readOnly
                    className="bg-muted/50 border-border font-mono flex-1"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemoveDnsServer(index)}
                    className="h-9 w-9 p-0 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Input
                value={newDnsServer}
                onChange={(e) => onNewDnsServerChange(e.target.value)}
                placeholder={t("network.dnsPlaceholder")}
                className="bg-muted/50 border-border focus:border-primary font-mono"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    onAddDnsServer();
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onAddDnsServer}
                className="shrink-0"
              >
                <Plus className="h-4 w-4 mr-1" />
                {t("network.addDns")}
              </Button>
            </div>
          </div>

          {/* Search Domains */}
          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {t("network.dnsSearch")}
            </Label>
            <Input
              value={dnsForm.search?.join(" ") ?? ""}
              onChange={(e) =>
                onDnsFormChange((prev) => ({
                  ...prev,
                  search: e.target.value
                    .split(/[\s,]+/)
                    .map((s) => s.trim())
                    .filter(Boolean),
                }))
              }
              placeholder="example.com"
              className="bg-muted/50 border-border focus:border-primary"
            />
          </div>

          <Button
            type="submit"
            disabled={isPending}
            className="bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-lg shadow-purple-500/20 hover:from-purple-400 hover:to-purple-500 transition-all"
          >
            <Save className="mr-2 h-4 w-4" />
            {isPending ? t("network.saving") : t("common.save")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
