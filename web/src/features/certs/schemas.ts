import { z } from "zod";

export const letsEncryptSchema = z.object({
  domain: z.string().min(1, "Domain is required"),
  email: z.string().min(1, "Email is required").email("Invalid email address"),
  autoRenew: z.boolean().default(true),
});

export const selfSignedSchema = z.object({
  domain: z.string().min(1, "Domain is required"),
  days: z.coerce.number().int().min(1).max(3650).default(365),
  autoRenew: z.boolean().default(false),
});

export type LetsEncryptFormData = z.infer<typeof letsEncryptSchema>;
export type SelfSignedFormData = z.infer<typeof selfSignedSchema>;
