import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import type { CreateRuleRequest } from "@/features/alerts/api";

interface AlertRuleFormProps {
  form: CreateRuleRequest;
  setForm: (f: CreateRuleRequest) => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  isPending: boolean;
}

export function AlertRuleForm({ form, setForm, onClose, onSubmit, isPending }: AlertRuleFormProps) {
  const t = useTranslation();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle>{t("alerts.newRule")}</CardTitle>
        <Button variant="ghost" size="sm" onClick={onClose}><X className="h-4 w-4" /></Button>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="space-y-2">
              <Label>{t("alerts.name")}</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t("alerts.namePlaceholder")} required />
            </div>
            <div className="space-y-2">
              <Label>{t("alerts.metric")}</Label>
              <select value={form.metric} onChange={(e) => setForm({ ...form, metric: e.target.value })} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                <option value="cpu">{t("alerts.metricCpu")}</option>
                <option value="memory">{t("alerts.metricMemory")}</option>
                <option value="disk">{t("alerts.metricDisk")}</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>{t("alerts.operator")}</Label>
              <select value={form.operator} onChange={(e) => setForm({ ...form, operator: e.target.value })} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                <option value="gt">{t("alerts.operatorGt")}</option>
                <option value="lt">{t("alerts.operatorLt")}</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>{t("alerts.threshold")}</Label>
              <Input type="number" min="0" max="100" value={form.threshold} onChange={(e) => setForm({ ...form, threshold: Number(e.target.value) })} required />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={isPending}>
              {isPending ? t("alerts.creating") : t("alerts.createRule")}
            </Button>
            <Button variant="outline" type="button" onClick={onClose}>{t("common.cancel")}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
