import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, AlertCircle, CheckCheck, BellOff } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import type { AlertEvent } from "@/features/alerts/api";

interface AlertEventsHistoryProps {
  events: AlertEvent[];
  unseen: number;
  onMarkSeen: () => void;
  onClearEvents: () => void;
}

export function AlertEventsHistory({ events, unseen, onMarkSeen, onClearEvents }: AlertEventsHistoryProps) {
  const t = useTranslation();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-lg">
          {t("alerts.history")}
          {unseen > 0 && <span className="ml-2 inline-flex items-center rounded-full bg-danger px-2 py-0.5 text-xs font-bold text-white shadow-sm shadow-danger/30">{unseen}</span>}
        </CardTitle>
        <div className="flex gap-2">
          {unseen > 0 && <Button variant="outline" size="sm" onClick={onMarkSeen}><CheckCheck className="mr-1 h-3 w-3" /> {t("alerts.markRead")}</Button>}
          {events.length > 0 && <Button variant="outline" size="sm" onClick={onClearEvents}><BellOff className="mr-1 h-3 w-3" /> {t("alerts.clear")}</Button>}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {events.map((event) => (
            <div key={event.id} className={"flex items-start gap-3 rounded-xl border px-4 py-3 transition-all " + (!event.seen ? "border-amber-500/30 bg-amber-500/5" : "border-border bg-card")}>
              {event.level === "critical" ? <AlertCircle className="mt-0.5 h-4 w-4 text-red-500 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-500 shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{event.ruleName}</p>
                <p className="text-xs text-muted-foreground truncate">{event.message}</p>
                <p className="text-xs text-muted-foreground mt-1">{event.createdAt}</p>
              </div>
              <span className={"shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium " + (event.level === "critical" ? "border-red-500/20 bg-red-500/10 text-red-400" : "border-amber-500/20 bg-amber-500/10 text-amber-400")}>{event.level}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
