import { useTranslation } from "@/hooks/useTranslation";
import type { PresetTemplate } from "@/features/firewall/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, X } from "lucide-react";

interface PresetTemplatesPanelProps {
  presets: PresetTemplate[];
  onSelect: (preset: PresetTemplate) => void;
  onClose: () => void;
}

export function PresetTemplatesPanel({ presets, onSelect, onClose }: PresetTemplatesPanelProps) {
  const t = useTranslation();

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{t("firewall.presetTemplates")}</CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {presets.map((preset) => (
            <button
              key={preset.id}
              onClick={() => onSelect(preset)}
              className="flex items-start gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:bg-accent"
            >
              <Shield className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div>
                <p className="text-sm font-medium">{preset.name}</p>
                <p className="text-xs text-muted-foreground">{preset.description}</p>
                <div className="mt-1 flex items-center gap-1.5">
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase">{preset.protocol}</span>
                  {preset.port && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium">{preset.port}</span>}
                  <span className="rounded bg-green-500/10 px-1.5 py-0.5 text-[10px] font-medium text-green-500">{preset.action}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
