import { api } from "@/api/http";

export interface ProxyRule {
  id: number;
  domain: string;
  target: string;
  protocol: string;
  enabled: boolean;
  createdAt: string;
}

export interface ProxyStatus {
  installed: boolean;
  running: boolean;
  version?: string;
}

export interface ProxyConfig {
  caddyfile: string;
}

export async function fetchProxyRules() {
  return api.get<{ data: ProxyRule[] }>("/proxy/rules");
}

export async function createProxyRule(data: { domain: string; target: string; protocol: string }) {
  return api.post<{ data: ProxyRule }>("/proxy/rules", data);
}

export async function updateProxyRule(id: number, data: { domain: string; target: string; protocol: string }) {
  return api.put<{ data: ProxyRule }>(`/proxy/rules/${id}`, data);
}

export async function deleteProxyRule(id: number) {
  return api.delete(`/proxy/rules/${id}`);
}

export async function toggleProxyRule(id: number, enabled: boolean) {
  return api.put(`/proxy/rules/${id}/toggle`, { enabled });
}

export async function fetchProxyStatus() {
  return api.get<{ data: ProxyStatus }>("/proxy/status");
}

export async function fetchProxyConfig() {
  return api.get<{ data: ProxyConfig }>("/proxy/config");
}

export async function reloadProxyConfig() {
  return api.post("/proxy/reload");
}
