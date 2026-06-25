import { z } from "zod";

export const interfaceConfigSchema = z.object({
  name: z.string().min(1),
  mode: z.enum(["dhcp", "static"]),
  address: z.string().optional().default(""),
  netmask: z.string().optional().default("255.255.255.0"),
  gateway: z.string().optional().default(""),
  dns: z.array(z.string()).optional().default([]),
}).superRefine((data, ctx) => {
  if (data.mode === "static") {
    if (!data.address || data.address.trim() === "") {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Address is required for static mode", path: ["address"] });
    }
  }
});

export type InterfaceConfigFormData = z.infer<typeof interfaceConfigSchema>;
