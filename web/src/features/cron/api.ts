import { api } from "@/api/http";

export interface ScheduledTask {
  id: number;
  name: string;
  command: string;
  schedule: string;
  enabled: boolean;
  lastRun: string;
  nextRun: string;
  lastStatus: "never" | "running" | "success" | "failed";
  output: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskRequest {
  name: string;
  command: string;
  schedule: string;
}

export async function fetchTasks() {
  return api.get<{ data: ScheduledTask[] }>("/cron/tasks");
}

export async function createTask(data: CreateTaskRequest) {
  return api.post<{ data: ScheduledTask }>("/cron/tasks", data);
}

export async function updateTask(id: number, data: CreateTaskRequest) {
  return api.put<{ data: ScheduledTask }>(`/cron/tasks/${id}`, data);
}

export async function deleteTask(id: number) {
  return api.delete<{ data: { status: string } }>(`/cron/tasks/${id}`);
}

export async function toggleTask(id: number, enabled: boolean) {
  return api.put<{ data: { status: string } }>(`/cron/tasks/${id}/toggle`, { enabled });
}

export async function runTask(id: number) {
  return api.post<{ data: ScheduledTask }>(`/cron/tasks/${id}/run`);
}
