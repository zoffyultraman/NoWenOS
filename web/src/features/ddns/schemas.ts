import { z } from "zod";

export const ddnsConfigSchema = z.object({
  provider: z.enum(["cloudflare", "dyndns", "noip", "duckdns", "custom"]),
  domain: z.string().min(1, "Domain is required"),
  username: z.string().optional().default(""),
  password: z.string().optional().default(""),
  enabled: z.boolean().default(true),
});

export type DDNSConfigFormData = z.infer<typeof ddnsConfigSchema>;
