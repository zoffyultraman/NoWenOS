import { z } from "zod";

export const createTaskSchema = z.object({
  name: z.string().min(1, "Task name is required").max(100),
  command: z.string().min(1, "Command is required"),
  schedule: z.string().min(1, "Schedule is required"),
});

export type CreateTaskFormData = z.infer<typeof createTaskSchema>;
