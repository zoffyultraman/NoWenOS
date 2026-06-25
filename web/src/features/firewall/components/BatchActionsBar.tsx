import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ToggleLeft, ToggleRight, Trash2, X } from "lucide-react";

interface BatchActionsBarProps {
  selectedCount: number;
  onBatchEnable: () => void;
  onBatchDisable: () => void;
  onBatchDelete: () => void;
  onClearSelection: () => void;
  isPending: boolean;
}

export function BatchActionsBar({
  selectedCount, onBatchEnable, onBatchDisable, onBatchDelete, onClearSelection, isPending,
}: BatchActionsBarProps) {
  const t = useTranslation();

  if (selectedCount === 0) return null;

  return (
    <Card className="border-primary/30">
      <CardContent className="flex items-center gap-3 py-2">
        <span className="text-sm text-muted-foreground">
          {t("firewall.selected").replace("{count}", String(selectedCount))}
        </span>
        <Button variant="outline" size="sm" onClick={onBatchEnable} disabled={isPending}>
          <ToggleRight className="mr-1.5 h-3.5 w-3.5" />
          {t("firewall.batchEnable")}
        </Button>
        <Button variant="outline" size="sm" onClick={onBatchDisable} disabled={isPending}>
          <ToggleLeft className="mr-1.5 h-3.5 w-3.5" />
          {t("firewall.batchDisable")}
        </Button>
        <Button variant="destructive" size="sm" onClick={onBatchDelete} disabled={isPending}>
          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
          {t("firewall.batchDelete")}
        </Button>
        <Button variant="ghost" size="sm" onClick={onClearSelection} className="ml-auto">
          <X className="h-3.5 w-3.5" />
        </Button>
      </CardContent>
    </Card>
  );
}
