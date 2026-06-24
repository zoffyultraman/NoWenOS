import { api } from "@/api/http";

export interface ContainerStats {
  containerId: string;
  name: string;
  cpuPercent: number;
  memoryUsage: number;
  memoryLimit: number;
  memoryPercent: number;
  netRx: number;
  netTx: number;
  blockRead: number;
  blockWrite: number;
  pids: number;
  timestamp: string;
}

export interface ContainerStatsHistory {
  id: number;
  containerId: string;
  name: string;
  cpuPercent: number;
  memoryUsage: number;
  memoryLimit: number;
  memoryPercent: number;
  netRx: number;
  netTx: number;
  blockRead: number;
  blockWrite: number;
  pids: number;
  createdAt: string;
}

export interface ContainerStatsResponse {
  data: ContainerStats[];
}

export interface StatsHistoryResponse {
  data: ContainerStatsHistory[];
}

export async function fetchContainerStats() {
  return api.get<ContainerStatsResponse>("/docker/stats");
}

export async function fetchStatsHistory(containerId: string, minutes: number = 60) {
  return api.get<StatsHistoryResponse>(
    `/docker/stats/${containerId}/history?minutes=${minutes}`
  );
}
