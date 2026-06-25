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

// --- Spin Down ---

export async function spinDownDevice(device: string) {
  return api.post(`/storage/spindown/${device}`);
}
