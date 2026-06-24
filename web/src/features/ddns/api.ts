import { api } from "@/api/http";

export interface DDNSConfig {
  id: number;
  provider: string;
  domain: string;
  username: string;
  password: string;
  ip: string;
  updatedAt: string;
  enabled: boolean;
}

export interface DDNSStatus {
  totalConfigs: number;
  enabledConfigs: number;
  currentIP: string;
  lastUpdate: string;
}

export interface DDNSUpdateLog {
  id: number;
  configId: number;
  oldIp: string;
  newIp: string;
  status: string;
  message: string;
  createdAt: string;
}

export async function fetchDDNSConfigs() {
  return api.get<{ data: DDNSConfig[] }>("/ddns/configs");
}

export async function createDDNSConfig(data: {
  provider: string;
  domain: string;
  username: string;
  password: string;
  enabled?: boolean;
}) {
  return api.post<{ data: DDNSConfig }>("/ddns/configs", data);
}

export async function updateDDNSConfig(
  id: number,
  data: {
    provider: string;
    domain: string;
    username: string;
    password: string;
    enabled?: boolean;
  }
) {
  return api.put<{ data: DDNSConfig }>(`/ddns/configs/${id}`, data);
}

export async function deleteDDNSConfig(id: number) {
  return api.delete(`/ddns/configs/${id}`);
}

export async function toggleDDNSConfig(id: number, enabled: boolean) {
  return api.put(`/ddns/configs/${id}/toggle`, { enabled });
}

export async function manualUpdateDDNS(id: number) {
  return api.post<{ data: DDNSConfig }>(`/ddns/configs/${id}/update`);
}

export async function fetchDDNSStatus() {
  return api.get<{ data: DDNSStatus }>("/ddns/status");
}

export async function fetchDDNSUpdateLog(id: number, limit = 50) {
  return api.get<{ data: DDNSUpdateLog[] }>(`/ddns/configs/${id}/log?limit=${limit}`);
}
