import { useTranslation } from "@/hooks/useTranslation";
import type { CreateRuleFormData } from "@/features/firewall/schemas";
import type { UseFormRegister, FieldErrors } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X } from "lucide-react";

interface FirewallRuleFormProps {
  editId: number | null;
  register: UseFormRegister<CreateRuleFormData>;
  errors: FieldErrors<CreateRuleFormData>;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
  isPending: boolean;
}

export function FirewallRuleForm({ editId, register, errors, onSubmit, onClose, isPending }: FirewallRuleFormProps) {
  const t = useTranslation();

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{editId !== null ? t("firewall.editRule") : t("firewall.newRule")}</CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="sm:col-span-2">
              <Label>{t("firewall.form.name")}</Label>
              <Input {...register("name")} placeholder={t("firewall.form.namePlaceholder")} className="mt-1" />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div>
              <Label>{t("firewall.form.chain")}</Label>
              <select {...register("chain")} className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors">
                <option value="INPUT">INPUT</option>
                <option value="OUTPUT">OUTPUT</option>
                <option value="FORWARD">FORWARD</option>
              </select>
              {errors.chain && <p className="text-xs text-destructive">{errors.chain.message}</p>}
            </div>
            <div>
              <Label>{t("firewall.form.protocol")}</Label>
              <select {...register("protocol")} className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors">
                <option value="tcp">TCP</option>
                <option value="udp">UDP</option>
                <option value="icmp">ICMP</option>
                <option value="any">{t("firewall.any")}</option>
              </select>
              {errors.protocol && <p className="text-xs text-destructive">{errors.protocol.message}</p>}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label>{t("firewall.form.source")}</Label>
              <Input {...register("source")} placeholder="0.0.0.0/0" className="mt-1" />
              {errors.source && <p className="text-xs text-destructive">{errors.source.message}</p>}
            </div>
            <div>
              <Label>{t("firewall.form.destination")}</Label>
              <Input {...register("destination")} placeholder="0.0.0.0/0" className="mt-1" />
              {errors.destination && <p className="text-xs text-destructive">{errors.destination.message}</p>}
            </div>
            <div>
              <Label>{t("firewall.form.port")}</Label>
              <Input {...register("port")} placeholder="80, 443, 8000:8100" className="mt-1" />
              {errors.port && <p className="text-xs text-destructive">{errors.port.message}</p>}
            </div>
            <div>
              <Label>{t("firewall.form.action")}</Label>
              <select {...register("action")} className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors">
                <option value="ACCEPT">ACCEPT</option>
                <option value="DROP">DROP</option>
                <option value="REJECT">REJECT</option>
              </select>
              {errors.action && <p className="text-xs text-destructive">{errors.action.message}</p>}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={isPending}>
              {editId !== null ? t("firewall.form.update") : t("firewall.form.create")}
            </Button>
            <Button variant="outline" type="button" onClick={onClose}>
              {t("common.cancel")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
