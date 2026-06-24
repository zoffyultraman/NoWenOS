import { api } from "@/api/http";

export interface AlertRule {
  id: number;
  name: string;
  metric: string;
  operator: string;
  threshold: number;
  enabled: boolean;
  createdAt: string;
}

export interface AlertEvent {
  id: number;
  ruleId: number;
  ruleName: string;
  metric: string;
  value: number;
  threshold: number;
  message: string;
  level: string;
  seen: boolean;
  createdAt: string;
}

export interface CreateRuleRequest {
  name: string;
  metric: string;
  operator: string;
  threshold: number;
}

export async function fetchAlertRules() {
  return api.get<{ data: AlertRule[] }>("/alerts/rules");
}

export async function createAlertRule(data: CreateRuleRequest) {
  return api.post<{ data: AlertRule }>("/alerts/rules", data);
}

export async function toggleAlertRule(id: number, enabled: boolean) {
  return api.put(`/alerts/rules/${id}/toggle`, { enabled });
}

export async function deleteAlertRule(id: number) {
  return api.delete(`/alerts/rules/${id}`);
}

export async function fetchAlertEvents(limit?: number) {
  const params = limit ? `?limit=${limit}` : "";
  return api.get<{ data: { events: AlertEvent[]; unseen: number } }>(`/alerts/events${params}`);
}

export async function markAlertsSeen() {
  return api.post("/alerts/events/seen");
}

export async function clearAlertEvents() {
  return api.delete("/alerts/events");
}

export interface NotificationChannel {
  id: number;
  name: string;
  type: string;
  config: string;
  enabled: boolean;
  createdAt: string;
}

export interface CreateChannelRequest {
  name: string;
  type: string;
  config: string;
}

export async function fetchNotificationChannels() {
  return api.get<{ data: NotificationChannel[] }>("/alerts/channels");
}

export async function createNotificationChannel(data: CreateChannelRequest) {
  return api.post<{ data: NotificationChannel }>("/alerts/channels", data);
}

export async function deleteNotificationChannel(id: number) {
  return api.delete("/alerts/channels/" + id);
}

export async function toggleNotificationChannel(id: number, enabled: boolean) {
  return api.put("/alerts/channels/" + id + "/toggle", { enabled });
}

export async function testNotificationChannel(id: number) {
  return api.post<{ data: { status: string } }>(`/alerts/channels/${id}/test`);
}

export async function linkRuleChannels(ruleId: number, channelIds: number[]) {
  return api.post<{ data: { status: string } }>(`/alerts/rules/${ruleId}/channels`, { channelIds });
}

export async function fetchRuleChannels(ruleId: number) {
  return api.get<{ data: number[] }>(`/alerts/rules/${ruleId}/channels`);
}
