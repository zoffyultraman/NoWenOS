import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ToggleLeft, ToggleRight, Trash2, Link } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import type { AlertRule } from "@/features/alerts/api";

interface AlertRulesListProps {
  rules: AlertRule[];
  onOpenLinkDialog: (ruleId: number) => void;
  onToggle: (args: { id: number; enabled: boolean }) => void;
  onDeleteClick: (rule: { id: number; name: string }) => void;
}

export function AlertRulesList({ rules, onOpenLinkDialog, onToggle, onDeleteClick }: AlertRulesListProps) {
  const t = useTranslation();

  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">{t("alerts.rules")}</CardTitle></CardHeader>
      <CardContent>
        <div className="space-y-2">
          {rules.map((rule) => (
            <div key={rule.id} className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 transition-all hover:border-border/80">
              <div className="flex items-center gap-3">
                <AlertTriangle className={"h-4 w-4 " + (rule.enabled ? "text-amber-400" : "text-muted-foreground/40")} />
                <div>
                  <p className="text-sm font-medium">{rule.name}</p>
                  <p className="text-xs text-muted-foreground">{rule.metric} {rule.operator === "gt" ? ">" : "<"} {rule.threshold}%</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => onOpenLinkDialog(rule.id)} className="h-8 w-8 p-0" title={t("alerts.linkChannels")}><Link className="h-4 w-4" /></Button>
                <Button variant="ghost" size="sm" onClick={() => onToggle({ id: rule.id, enabled: !rule.enabled })} className="h-8 w-8 p-0">
                  {rule.enabled ? <ToggleRight className="h-5 w-5 text-green-600" /> : <ToggleLeft className="h-5 w-5 text-muted-foreground" />}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onDeleteClick({ id: rule.id, name: rule.name })} className="h-8 w-8 p-0 text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
