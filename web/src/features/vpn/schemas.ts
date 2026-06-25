import { z } from "zod";

export const vpnConfigSchema = z.object({
  name: z.string().min(1, "Config name is required").max(100),
  type: z.enum(["wireguard", "openvpn"]),
  config: z.string().min(1, "Config content is required"),
});

export type VPNConfigFormData = z.infer<typeof vpnConfigSchema>;
