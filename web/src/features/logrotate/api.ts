import { api } from "@/api/http";

export interface LogRotateConfig {
  id: number;
  name: string;
  logPaths: string;
  frequency: string;
  rotateCount: number;
  maxSize: string;
  compress: boolean;
  createMode: string;
  postRotate: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateConfigRequest {
  name: string;
  logPaths: string;
  frequency?: string;
  rotateCount?: number;
  maxSize?: string;
  compress?: boolean;
  createMode?: string;
  postRotate?: string;
}

export interface TestResult {
  output: string;
}

export async function fetchConfigs() {
  return api.get<{ data: LogRotateConfig[] }>("/logrotate/configs");
}

export async function createConfig(data: CreateConfigRequest) {
  return api.post<{ data: LogRotateConfig }>("/logrotate/configs", data);
}

export async function updateConfig(id: number, data: CreateConfigRequest) {
  return api.put<{ data: LogRotateConfig }>(`/logrotate/configs/${id}`, data);
}

export async function deleteConfig(id: number) {
  return api.delete(`/logrotate/configs/${id}`);
}

export async function toggleConfig(id: number, enabled: boolean) {
  return api.post(`/logrotate/configs/${id}/toggle`, { enabled });
}

export async function applyConfig(id: number) {
  return api.post<{ data: { status: string } }>(`/logrotate/configs/${id}/apply`);
}

export async function testConfig(id: number) {
  return api.post<{ data: TestResult }>(`/logrotate/configs/${id}/test`);
}
