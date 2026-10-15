import { z } from "zod";
export const notificationSchema = z.object({
  enabled: z.boolean().default(false),
  daily: z.boolean().default(true),
  weekly: z.boolean().default(false),
  important: z.boolean().default(false),
  send_time: z
    .string()
    .regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/)
    .default("09:00"),
  privacy: z.boolean().default(true),
  tenant_confirmed: z.boolean().default(false),
});
export type NotificationSettings = z.output<typeof notificationSchema>;
