import { api } from "@/api/http";

export interface FileShareLink {
  id: number;
  filePath: string;
  fileName: string;
  token: string;
  expiresAt: string;
  maxDownloads: number;
  downloadCount: number;
  createdAt: string;
}

export interface FileShareListResponse {
  data: FileShareLink[];
}

export interface FileShareResponse {
  data: FileShareLink;
}

export interface CreateFileShareRequest {
  filePath: string;
  expiresHours?: number;
  maxDownloads?: number;
}

export async function createFileShare(data: CreateFileShareRequest) {
  return api.post<FileShareResponse>("/files/share", data);
}

export async function listFileShares() {
  return api.get<FileShareListResponse>("/files/shares");
}

export async function deleteFileShare(token: string) {
  return api.delete(`/files/share/${token}`);
}

export function getShareDownloadUrl(token: string): string {
  return `/api/v1/files/share/${token}`;
}
