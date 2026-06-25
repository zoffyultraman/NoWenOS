import { z } from "zod";

export const createShareSchema = z.object({
  name: z.string().min(1, "Share name is required").max(100),
  path: z.string().min(1, "Path is required"),
  protocol: z.enum(["smb", "webdav", "nfs"]),
  readOnly: z.boolean().default(false),
  guest: z.boolean().default(false),
  comment: z.string().optional().default(""),
});

export type CreateShareFormData = z.infer<typeof createShareSchema>;
