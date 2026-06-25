import { useTranslation } from "@/hooks/useTranslation";
import type { FirewallRule } from "@/features/firewall/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Shield, ToggleLeft, ToggleRight,
  Pencil, Trash2, ChevronUp, ChevronDown, CheckSquare, Square,
} from "lucide-react";

interface FirewallRulesTableProps {
  rules: FirewallRule[];
  selectedIds: Set<number>;
  allSelected: boolean;
  onToggleSelect: (id: number) => void;
  onToggleSelectAll: () => void;
  onToggle: (id: number, enabled: boolean) => void;
  onMove: (index: number, direction: -1 | 1) => void;
  onEdit: (rule: FirewallRule) => void;
  onDelete: (id: number, name: string) => void;
}

export function FirewallRulesTable({
  rules, selectedIds, allSelected,
  onToggleSelect, onToggleSelectAll, onToggle, onMove, onEdit, onDelete,
}: FirewallRulesTableProps) {
  const t = useTranslation();

  if (rules.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Shield className="h-10 w-10 text-muted-foreground/50 mb-3" />
          <p className="text-sm text-muted-foreground">{t("firewall.noRules")}</p>
          <p className="text-xs text-muted-foreground mt-1">{t("firewall.firstRule")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="w-10 px-4 py-3 text-left">
                  <button onClick={onToggleSelectAll} className="text-muted-foreground hover:text-foreground">
                    {allSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                  </button>
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("firewall.table.name")}</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("firewall.table.chain")}</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("firewall.table.protocol")}</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("firewall.table.source")}</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("firewall.table.destination")}</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("firewall.table.port")}</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("firewall.table.action")}</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">{t("firewall.table.status")}</th>
                <th className="w-32 px-4 py-3 text-right font-medium text-muted-foreground">{t("firewall.table.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule, index) => (
                <tr key={rule.id} className={"border-b border-border/50 transition-colors hover:bg-muted/30 " + (selectedIds.has(rule.id) ? "bg-primary/5" : "")}>
                  <td className="px-4 py-3">
                    <button onClick={() => onToggleSelect(rule.id)} className="text-muted-foreground hover:text-foreground">
                      {selectedIds.has(rule.id) ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4" />}
                    </button>
                  </td>
                  <td className="px-4 py-3 font-medium">{rule.name || "-"}</td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase">{rule.chain}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium uppercase text-blue-500">{rule.protocol}</span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{rule.source || "*"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{rule.destination || "*"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{rule.port || "*"}</td>
                  <td className="px-4 py-3">
                    <span className={"rounded px-1.5 py-0.5 text-[10px] font-medium uppercase " + (rule.action === "ACCEPT" ? "bg-green-500/10 text-green-500" : rule.action === "DROP" ? "bg-red-500/10 text-red-500" : "bg-amber-500/10 text-amber-500")}>
                      {rule.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => onToggle(rule.id, !rule.enabled)}
                      className="inline-flex"
                      title={rule.enabled ? t("common.disable") : t("common.enable")}
                    >
                      {rule.enabled ? <ToggleRight className="h-5 w-5 text-green-500" /> : <ToggleLeft className="h-5 w-5 text-muted-foreground" />}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => onMove(index, -1)} disabled={index === 0} className="h-7 w-7 p-0" title={t("firewall.moveUp")}>
                        <ChevronUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => onMove(index, 1)} disabled={index === rules.length - 1} className="h-7 w-7 p-0" title={t("firewall.moveDown")}>
                        <ChevronDown className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => onEdit(rule)} className="h-7 w-7 p-0" title={t("common.edit")}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => onDelete(rule.id, rule.name)} className="h-7 w-7 p-0 text-destructive hover:text-destructive" title={t("common.delete")}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
