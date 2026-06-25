import type { UseFormRegister, UseFormHandleSubmit, FieldErrors } from "react-hook-form";
import type { VPNConfigFormData } from "@/features/vpn/schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslation } from "@/hooks/useTranslation";
import { X } from "lucide-react";

export interface VPNConfigDialogForm {
  register: UseFormRegister<VPNConfigFormData>;
  handleSubmit: UseFormHandleSubmit<VPNConfigFormData>;
  formState: { errors: FieldErrors<VPNConfigFormData> };
}

interface VPNConfigDialogProps {
  mode: "add" | "edit";
  form: VPNConfigDialogForm;
  isPending: boolean;
  onSubmit: (data: VPNConfigFormData) => void;
  onClose: () => void;
}

export function VPNConfigDialog({ mode, form, isPending, onSubmit, onClose }: VPNConfigDialogProps) {
  const t = useTranslation();
  const { register, handleSubmit, formState: { errors } } = form;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border bg-background p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">
            {mode === "edit" ? t("vpn.editConfig") : t("vpn.newConfig")}
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label>{t("vpn.configName")}</Label>
            <Input
              {...register("name")}
              placeholder={t("vpn.configNamePlaceholder")}
              className="mt-1"
            />
            {errors.name && (
              <p className="mt-1 text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>
          <div>
            <Label>{t("vpn.type")}</Label>
            <select
              {...register("type")}
              className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors"
            >
              <option value="wireguard">{t("vpn.wireguard")}</option>
              <option value="openvpn">{t("vpn.openvpn")}</option>
            </select>
            {errors.type && (
              <p className="mt-1 text-xs text-destructive">{errors.type.message}</p>
            )}
          </div>
          <div>
            <Label>{t("vpn.config")}</Label>
            <textarea
              {...register("config")}
              placeholder={t("vpn.configPlaceholder")}
              rows={10}
              className="mt-1 flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono"
            />
            {errors.config && (
              <p className="mt-1 text-xs text-destructive">{errors.config.message}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={isPending}>
              {mode === "edit" ? t("vpn.update") : t("vpn.create")}
            </Button>
            <Button variant="outline" type="button" onClick={onClose}>
              {t("common.cancel")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
