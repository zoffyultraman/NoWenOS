import { api } from "@/api/http";

export interface VPNConfig {
  id: number;
  name: string;
  type: "wireguard" | "openvpn";
  config: string;
  enabled: boolean;
  createdAt: string;
}

export interface VPNStatus {
  connected: boolean;
  configId?: number;
  configName?: string;
  type?: string;
  connectedAt?: string;
  bytesRx: number;
  bytesTx: number;
  publicIP?: string;
}

export interface WireGuardKeyPair {
  privateKey: string;
  publicKey: string;
}

export interface WireGuardConfigParams {
  privateKey: string;
  address: string;
  dns: string;
  publicKey: string;
  endpoint: string;
  allowedIPs: string;
}

export interface OpenVPNInfo {
  remote?: string;
  port?: string;
  protocol?: string;
  device?: string;
  comment?: string;
}

export async function fetchVPNConfigs() {
  return api.get<{ data: VPNConfig[] }>("/vpn/configs");
}

export async function createVPNConfig(data: { name: string; type: string; config: string }) {
  return api.post<{ data: VPNConfig }>("/vpn/configs", data);
}

export async function updateVPNConfig(id: number, data: { name: string; type: string; config: string }) {
  return api.put<{ data: VPNConfig }>(`/vpn/configs/${id}`, data);
}

export async function deleteVPNConfig(id: number) {
  return api.delete(`/vpn/configs/${id}`);
}

export async function connectVPN(id: number) {
  return api.post<{ data: VPNStatus }>(`/vpn/configs/${id}/connect`);
}

export async function disconnectVPN(id: number) {
  return api.post(`/vpn/configs/${id}/disconnect`);
}

export async function fetchVPNStatus() {
  return api.get<{ data: VPNStatus }>("/vpn/status");
}

export async function generateWireGuardKeys() {
  return api.post<{ data: WireGuardKeyPair }>("/vpn/wireguard/generate-keys");
}

export async function generateWireGuardConfig(params: WireGuardConfigParams) {
  return api.post<{ data: { config: string } }>("/vpn/wireguard/generate-config", params);
}

export async function parseOpenVPNConfig(config: string) {
  return api.post<{ data: OpenVPNInfo }>("/vpn/openvpn/parse", { config });
}
