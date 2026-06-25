import { z } from "zod";

export const createLogRotateSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  logPaths: z.string().min(1, "Log paths are required"),
  frequency: z.enum(["daily", "weekly", "monthly"]).default("daily"),
  rotateCount: z.coerce.number().int().min(1).max(999).default(7),
  maxSize: z.string().optional().default("100M"),
  compress: z.boolean().default(true),
  createMode: z.string().optional().default("0644"),
  postRotate: z.string().optional().default(""),
});

export type CreateLogRotateFormData = z.infer<typeof createLogRotateSchema>;
