import { api } from "@/api/http";
import type { ApiEnvelope } from "@/types";

// --- Types ---

export interface InterfaceConfig {
  name: string;
  mode: "dhcp" | "static";
  address?: string;
  netmask?: string;
  gateway?: string;
  dns?: string[];
}

export interface NetworkInterface {
  name: string;
  mac: string;
  ipAddress: string;
  netmask: string;
  gateway: string;
  status: "up" | "down";
  speed: string;
  mtu: number;
  rxBytes: number;
  txBytes: number;
  rxPackets: number;
  txPackets: number;
  rxErrors: number;
  txErrors: number;
  rxDropped: number;
  txDropped: number;
  isConfigured: boolean;
  config?: InterfaceConfig;
}

export interface DNSConfig {
  servers: string[];
  search?: string[];
}

export interface NetworkInterfacesResponse {
  data: NetworkInterface[];
}

export interface NetworkInterfaceResponse {
  data: NetworkInterface;
}

export interface DNSResponse {
  data: DNSConfig;
}

export interface ActionResponse {
  data: {
    status: string;
    name?: string;
    action?: string;
  };
}

// --- API Functions ---

export async function fetchInterfaces(): Promise<NetworkInterfacesResponse> {
  return api.get<NetworkInterfacesResponse>("/network/interfaces");
}

export async function fetchInterface(
  name: string
): Promise<NetworkInterfaceResponse> {
  return api.get<NetworkInterfaceResponse>(`/network/interfaces/${name}`);
}

export async function configureInterface(
  name: string,
  config: InterfaceConfig
): Promise<ActionResponse> {
  return api.put<ActionResponse>(`/network/interfaces/${name}`, config);
}

export async function bringUpInterface(name: string): Promise<ActionResponse> {
  return api.post<ActionResponse>(`/network/interfaces/${name}/up`);
}

export async function bringDownInterface(
  name: string
): Promise<ActionResponse> {
  return api.post<ActionResponse>(`/network/interfaces/${name}/down`);
}

export async function fetchDNS(): Promise<DNSResponse> {
  return api.get<DNSResponse>("/network/dns");
}

export async function updateDNS(config: DNSConfig): Promise<ActionResponse> {
  return api.put<ActionResponse>("/network/dns", config);
}

// --- Utility ---

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(1)} ${units[i]}`;
}
