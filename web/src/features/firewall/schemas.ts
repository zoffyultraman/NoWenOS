import { z } from "zod";

export const createRuleSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  chain: z.enum(["INPUT", "OUTPUT", "FORWARD"]),
  protocol: z.enum(["tcp", "udp", "icmp", "any"]),
  source: z.string().optional().default(""),
  destination: z.string().optional().default(""),
  port: z.string().optional().default(""),
  action: z.enum(["ACCEPT", "DROP", "REJECT"]),
});

export type CreateRuleFormData = z.infer<typeof createRuleSchema>;
