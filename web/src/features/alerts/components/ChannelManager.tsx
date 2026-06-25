import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Mail, Globe, Send, ToggleLeft, ToggleRight, Zap } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import type { NotificationChannel, CreateChannelRequest } from "@/features/alerts/api";

interface ChannelManagerProps {
  channels: NotificationChannel[];
  showChannelForm: boolean;
  setShowChannelForm: (v: boolean) => void;
  channelForm: CreateChannelRequest;
  setChannelForm: (f: (prev: CreateChannelRequest) => CreateChannelRequest) => void;
  onCreateChannel: () => void;
  isCreating: boolean;
  onToggleChannel: (args: { id: number; enabled: boolean }) => void;
  onTestChannel: (id: number) => void;
  isTesting: boolean;
  onDeleteClick: (ch: { id: number; name: string }) => void;
  // Link dialog
  linkRuleId: number | null;
  onCloseLinkDialog: () => void;
  selectedChannelIds: number[];
  onToggleSelection: (id: number) => void;
  onLinkChannels: () => void;
  isLinking: boolean;
}

export function ChannelManager({
  channels, showChannelForm, setShowChannelForm,
  channelForm, setChannelForm, onCreateChannel, isCreating,
  onToggleChannel, onTestChannel, isTesting, onDeleteClick,
  linkRuleId, onCloseLinkDialog, selectedChannelIds,
  onToggleSelection, onLinkChannels, isLinking,
}: ChannelManagerProps) {
  const t = useTranslation();

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-lg">{t("alerts.notificationChannels")}</CardTitle>
          <Button size="sm" onClick={() => setShowChannelForm(!showChannelForm)}><Plus className="mr-1 h-3 w-3" />{t("alerts.addChannel")}</Button>
        </CardHeader>
        <CardContent>
          {showChannelForm && (
            <div className="mb-4 rounded-xl border border-border p-4 space-y-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <Label className="text-xs">{t("alerts.channelName")}</Label>
                  <Input value={channelForm.name} onChange={(e) => setChannelForm((p) => ({ ...p, name: e.target.value }))} placeholder={t("alerts.channelNamePlaceholder")} className="mt-1 h-8 text-xs" />
                </div>
                <div>
                  <Label className="text-xs">{t("alerts.channelType")}</Label>
                  <select value={channelForm.type} onChange={(e) => setChannelForm((p) => ({ ...p, type: e.target.value }))} className="mt-1 flex h-8 w-full rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-sm">
                    <option value="webhook">Webhook</option>
                    <option value="email">Email</option>
                    <option value="telegram">Telegram</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs">{channelForm.type === "webhook" ? t("alerts.fieldUrl") : channelForm.type === "email" ? t("alerts.fieldEmail") : t("alerts.fieldBotToken")}</Label>
                  <Input value={channelForm.config} onChange={(e) => setChannelForm((p) => ({ ...p, config: e.target.value }))} placeholder={channelForm.type === "webhook" ? "https://hooks.example.com/..." : channelForm.type === "email" ? "admin@example.com" : "bot_token:chat_id"} className="mt-1 h-8 text-xs" />
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="h-7 text-xs" onClick={onCreateChannel} disabled={isCreating}>{t("alerts.addChannel")}</Button>
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setShowChannelForm(false)}>{t("common.cancel")}</Button>
              </div>
            </div>
          )}
          <div className="space-y-2">
            {channels.map((ch) => (
              <div key={ch.id} className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
                <div className="flex items-center gap-3">
                  {ch.type === "email" ? <Mail className="h-4 w-4 text-blue-400" /> : ch.type === "telegram" ? <Send className="h-4 w-4 text-sky-400" /> : <Globe className="h-4 w-4 text-indigo-400" />}
                  <div>
                    <p className="text-sm font-medium">{ch.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{ch.type} &middot; {ch.enabled ? t("common.enabled") : t("common.disabled")}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => onTestChannel(ch.id)} className="h-8 w-8 p-0" title={t("alerts.testChannel")} disabled={isTesting}><Zap className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => onToggleChannel({ id: ch.id, enabled: !ch.enabled })} className="h-8 w-8 p-0">
                    {ch.enabled ? <ToggleRight className="h-5 w-5 text-green-600" /> : <ToggleLeft className="h-5 w-5 text-muted-foreground" />}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => onDeleteClick({ id: ch.id, name: ch.name })} className="h-8 w-8 p-0 text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Modal open={linkRuleId !== null} onClose={onCloseLinkDialog} title={t("alerts.linkChannels")} size="sm">
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {channels.map((ch) => (
            <label key={ch.id} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2 cursor-pointer hover:bg-accent/50">
              <input type="checkbox" checked={selectedChannelIds.includes(ch.id)} onChange={() => onToggleSelection(ch.id)} className="h-4 w-4 rounded" />
              {ch.type === "email" ? <Mail className="h-4 w-4 text-blue-400" /> : ch.type === "telegram" ? <Send className="h-4 w-4 text-sky-400" /> : <Globe className="h-4 w-4 text-indigo-400" />}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{ch.name}</p>
                <p className="text-xs text-muted-foreground capitalize">{ch.type}</p>
              </div>
            </label>
          ))}
        </div>
        <div className="flex gap-2 mt-4">
          <Button size="sm" onClick={onLinkChannels} disabled={isLinking}>
            {isLinking ? t("common.loading") : t("alerts.saveLink")}
          </Button>
          <Button variant="outline" size="sm" onClick={onCloseLinkDialog}>{t("common.cancel")}</Button>
        </div>
      </Modal>
    </>
  );
}
