import { api } from "@/api/http";

export interface TwoFAEnableResponse {
  data: {
    secret: string;
    otpUri: string;
    backupCodes: string[];
  };
}

export interface TwoFAStatusResponse {
  data: {
    enabled: boolean;
  };
}

export interface TwoFAVerifyRequest {
  code: string;
}

export interface TwoFASetupResponse {
  data: {
    secret: string;
    otpUri: string;
    backupCodes: string[];
  };
}

export async function enable2FA() {
  return api.post<TwoFAEnableResponse>("/2fa/enable");
}

export async function verify2FA(code: string) {
  return api.post<{ data: { status: string } }>("/2fa/verify", { code });
}

export async function disable2FA(code: string) {
  return api.post<{ data: { status: string } }>("/2fa/disable", { code });
}

export async function get2FAStatus() {
  return api.get<TwoFAStatusResponse>("/2fa/status");
}

export async function backupVerify2FA(code: string) {
  return api.post<{ data: { status: string } }>("/2fa/backup-verify", { code });
}

export async function get2FASetup() {
  return api.get<TwoFASetupResponse>("/2fa/setup");
}

export interface TwoFALoginRequest {
  username: string;
  password: string;
  code: string;
}

export interface TwoFALoginResponse {
  data: {
    token: string;
    username: string;
    role: string;
  };
}

export async function loginWith2FA(payload: TwoFALoginRequest) {
  return api.post<TwoFALoginResponse>("/auth/login/2fa", payload);
}
