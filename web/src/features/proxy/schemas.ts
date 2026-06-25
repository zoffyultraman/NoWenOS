import { z } from "zod";

export const createProxyRuleSchema = z.object({
  domain: z.string().min(1, "Domain is required"),
  target: z.string().min(1, "Target is required"),
  protocol: z.enum(["http", "https"]),
});

export type CreateProxyRuleFormData = z.infer<typeof createProxyRuleSchema>;
