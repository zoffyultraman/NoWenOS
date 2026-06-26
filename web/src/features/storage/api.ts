import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/http";

export interface DiskInfo {
  name: string;
  size: string;
  sizeBytes: number;
  used: string;
  usedBytes: number;
  avail: string;
  availBytes: number;
  usedPct: number;
  model: string;
  type: string;
  mountpoint: string;
  fstype: string;
}

export interface DisksResponse {
  data: DiskInfo[];
}

export async function fetchDisks() {
  return api.get<DisksResponse>("/storage/disks");
}

// --- SMART ---

export interface SmartInfo {
  smartStatus: { passed: boolean };
  temperature: number;
  powerOnHours: number;
  reallocatedSectors: number;
  pendingSectors: number;
  attributes: { id: number; name: string; value: string; raw: string }[];
}

export interface SmartResponse {
  data: SmartInfo;
}

export async function fetchSmartInfo(device: string) {
  return api.get<SmartResponse>(`/storage/smart/${device}`);
}

// --- Mountpoints ---

export interface Mountpoint {
  source: string;
  target: string;
  fstype: string;
  options: string;
  usedPct: number;
}

export interface MountpointsResponse {
  data: Mountpoint[];
}

export async function fetchMountpoints() {
  return api.get<MountpointsResponse>("/storage/mountpoints");
}

export async function mountDevice(device: string, mountpoint: string) {
  return api.post("/storage/mount", { device, mountpoint });
}

export async function unmountDevice(mountpoint: string) {
  return api.post("/storage/unmount", { mountpoint });
}

// --- RAID ---

export interface RAIDArray {
  name: string;
  level: string;
  state: string;
  size: string;
  active: number;
  working: number;
  failed: number;
  spare: number;
  rebuildPct?: string;
  devices: string[];
  uuid?: string;
  personality?: string;
}

export interface RAIDResponse {
  data: RAIDArray[];
}

export async function fetchRAIDStatus() {
  return api.get<RAIDResponse>("/storage/raid");
}

// --- LVM ---

export interface PVInfo {
  name: string;
  vgName: string;
  size: string;
  free: string;
  uuid?: string;
}

export interface VGInfo {
  name: string;
  pvCount: number;
  lvCount: number;
  size: string;
  free: string;
  uuid?: string;
}

export interface LVInfo {
  name: string;
  vgName: string;
  size: string;
  path?: string;
  uuid?: string;
}

export interface LVMInfo {
  physicalVolumes: PVInfo[];
  volumeGroups: VGInfo[];
  logicalVolumes: LVInfo[];
}

export interface LVMResponse {
  data: LVMInfo;
}

export async function fetchLVMInfo() {
  return api.get<LVMResponse>("/storage/lvm");
}

// --- ZFS ---

export interface ZFSVDev {
  name: string;
  state: string;
  read?: string;
  write?: string;
  cksum?: string;
  children?: ZFSVDev[];
}

export interface ZFSPool {
  name: string;
  size: string;
  allocated: string;
  free: string;
  health: string;
  readOnly?: string;
  scan?: string;
  devices: ZFSVDev[];
}

export interface ZFSDataset {
  name: string;
  used: string;
  avail: string;
  refer: string;
  mountpoint?: string;
  type: string;
}

export interface ZFSInfo {
  pools: ZFSPool[];
  datasets: ZFSDataset[];
}

export interface ZFSResponse {
  data: ZFSInfo;
}

export async function fetchZFSInfo() {
  return api.get<ZFSResponse>("/storage/zfs");
}

// --- Disk Operations (convenience wrappers around createStorageTask) ---

export async function wipeDisk(device: string, password: string) {
  return createStorageTask("wipe", { device }, password);
}

export async function formatDisk(
  device: string,
  fstype: string,
  label: string,
  password: string,
) {
  return createStorageTask("format", { device, fstype, label }, password);
}

export async function partitionDisk(
  device: string,
  scheme: string,
  password: string,
) {
  return createStorageTask("partition", { device, scheme }, password);
}

// --- Spin Down ---

export async function spinDownDevice(device: string) {
  return api.post(`/storage/spindown/${device}`);
}

// --- Tasks ---

export interface TaskInfo {
  id: number;
  type: string;
  payload: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  progress: number;
  log: string;
  error_msg: string;
  result: string;
  created_at: string;
  updated_at: string;
}

export interface TaskResponse {
  data: TaskInfo;
}

export interface CreateTaskResponse {
  data: { task_id: number; status: string };
}

export interface TaskLog {
  id: number;
  task_id: number;
  stream: "stdout" | "stderr" | "system";
  content: string;
  timestamp: string;
}

export interface TaskLogsResponse {
  data: TaskLog[];
}

export async function fetchTask(taskId: number) {
  return api.get<TaskResponse>(`/tasks/${taskId}`);
}

export async function fetchTaskLogs(taskId: number, sinceId?: number) {
  const query = sinceId ? `?since=${sinceId}` : "";
  return api.get<TaskLogsResponse>(`/tasks/${taskId}/logs${query}`);
}

export async function cancelTask(taskId: number) {
  return api.post(`/tasks/${taskId}/cancel`);
}

/**
 * Create a storage task (wipe, format, partition, raid, lvm, zfs).
 * Sends the password via X-Confirm-Password header for the password challenge.
 */
export async function createStorageTask(
  type: string,
  payload: Record<string, unknown>,
  password: string,
) {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Confirm-Password": password,
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`/api/v1/storage/tasks/${type}`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message = body?.error || "Request failed";
    throw new Error(message);
  }

  return (await response.json()) as CreateTaskResponse;
}

function getToken(): string | null {
  try {
    const stored = localStorage.getItem("nowenos-session");
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed?.state?.token ?? null;
    }
  } catch {
    // ignore
  }
  return null;
}

// --- TanStack Query hooks for task polling ---

const TERMINAL_STATUSES = new Set(["completed", "failed", "cancelled"]);

/**
 * Polls a task by ID using TanStack Query's refetchInterval.
 * Automatically stops polling when the task reaches a terminal state.
 */
export function useTaskQuery(taskId: number | null) {
  return useQuery({
    queryKey: ["task", taskId],
    queryFn: () => fetchTask(taskId!),
    enabled: taskId != null,
    refetchInterval: (query) => {
      const status = query.state.data?.data?.status;
      if (!status || TERMINAL_STATUSES.has(status)) {
        return false; // stop polling
      }
      return 1500; // 1.5s while running
    },
  });
}

/**
 * Polls task logs using TanStack Query's refetchInterval.
 * Stops when the task reaches a terminal state.
 */
export function useTaskLogsQuery(taskId: number | null, taskStatus?: string) {
  return useQuery({
    queryKey: ["taskLogs", taskId],
    queryFn: () => fetchTaskLogs(taskId!),
    enabled: taskId != null,
    refetchInterval: () => {
      if (!taskStatus || TERMINAL_STATUSES.has(taskStatus)) {
        return false; // stop polling once task is done
      }
      return 800; // 800ms while running
    },
  });
}
