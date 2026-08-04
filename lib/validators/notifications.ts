import { z } from "zod";
import { notificationDeliveryPreferences, notificationModules, notificationTypes } from "@/lib/notifications/types";

export const notificationListSchema = z.object({
  module: z.enum(notificationModules).optional(),
  type: z.enum(notificationTypes).optional(),
  read: z.enum(["ALL", "READ", "UNREAD"]).default("ALL"),
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export const notificationReadSchema = z.object({ read: z.boolean() });
export const notificationReadAllSchema = z.object({ module: z.enum(notificationModules).optional(), type: z.enum(notificationTypes).optional() });
export const notificationPreferenceSchema = z.object({ type: z.enum(notificationTypes), delivery: z.enum(notificationDeliveryPreferences) });
