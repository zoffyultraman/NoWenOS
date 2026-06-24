import { api } from "@/api/http";

export interface Certificate {
  id: number;
  domain: string;
  type: string; // "letsencrypt" | "selfsigned"
  certPath: string;
  keyPath: string;
  expiresAt: string;
  autoRenew: boolean;
  createdAt: string;
}

export interface CertStatus {
  certbotInstalled: boolean;
  certbotVersion?: string;
}

export async function fetchCertificates() {
  return api.get<{ data: Certificate[] }>("/certs");
}

export async function fetchCertStatus() {
  return api.get<{ data: CertStatus }>("/certs/status");
}

export async function requestLetsEncrypt(data: { domain: string; email: string; autoRenew: boolean }) {
  return api.post<{ data: Certificate }>("/certs/letsencrypt", data);
}

export async function generateSelfSigned(data: { domain: string; days: number; autoRenew: boolean }) {
  return api.post<{ data: Certificate }>("/certs/selfsigned", data);
}

export async function deleteCertificate(id: number) {
  return api.delete(`/certs/${id}`);
}

export async function renewCertificate(id: number) {
  return api.post<{ data: Certificate }>(`/certs/${id}/renew`);
}

export async function toggleAutoRenew(id: number, autoRenew: boolean) {
  return api.put(`/certs/${id}/autorenew`, { autoRenew });
}
