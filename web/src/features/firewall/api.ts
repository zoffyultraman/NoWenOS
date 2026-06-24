import { api } from "@/api/http";

export interface FirewallRule {
  id: number;
  name: string;
  chain: string;
  protocol: string;
  source: string;
  destination: string;
  port: string;
  action: string;
  enabled: boolean;
  position: number;
  createdAt: string;
}

export interface FirewallStatus {
  backend: string;
  installed: boolean;
  running: boolean;
  version?: string;
  ruleCount: number;
}

export interface PresetTemplate {
  id: string;
  name: string;
  description: string;
  chain: string;
  protocol: string;
  port: string;
  action: string;
}

export interface CreateRulePayload {
  name: string;
  chain: string;
  protocol: string;
  source: string;
  destination: string;
  port: string;
  action: string;
}

export async function fetchFirewallRules() {
  return api.get<{ data: FirewallRule[] }>("/firewall/rules");
}

export async function createFirewallRule(data: CreateRulePayload) {
  return api.post<{ data: FirewallRule }>("/firewall/rules", data);
}

export async function updateFirewallRule(id: number, data: CreateRulePayload) {
  return api.put<{ data: FirewallRule }>(`/firewall/rules/${id}`, data);
}

export async function deleteFirewallRule(id: number) {
  return api.delete(`/firewall/rules/${id}`);
}

export async function toggleFirewallRule(id: number, enabled: boolean) {
  return api.post(`/firewall/rules/${id}/toggle`, { enabled });
}

export async function reorderFirewallRules(order: number[]) {
  return api.post("/firewall/rules/reorder", { order });
}

export async function batchToggleFirewallRules(ids: number[], enabled: boolean) {
  return api.post("/firewall/rules/batch/toggle", { ids, enabled });
}

export async function batchDeleteFirewallRules(ids: number[]) {
  return api.post("/firewall/rules/batch/delete", { ids });
}

export async function fetchFirewallStatus() {
  return api.get<{ data: FirewallStatus }>("/firewall/status");
}

export async function applyFirewallRules(backend?: string) {
  return api.post("/firewall/apply", { backend });
}

export async function fetchPresetTemplates() {
  return api.get<{ data: PresetTemplate[] }>("/firewall/presets");
}
