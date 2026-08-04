import type { NotificationDeliveryPreference, NotificationType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export const DEFAULT_NOTIFICATION_PREFERENCE: NotificationDeliveryPreference = "BOTH";
export const includesInAppDelivery = (delivery: NotificationDeliveryPreference) => delivery === "BOTH" || delivery === "IN_APP";

export async function getNotificationPreferences(userId: string) {
  return prisma.notificationPreference.findMany({ where: { userId }, orderBy: { type: "asc" } });
}

export async function getPreferenceMap(userIds: string[], type: NotificationType) {
  const rows = await prisma.notificationPreference.findMany({ where: { userId: { in: userIds }, type } });
  return new Map(rows.map((row) => [row.userId, row.delivery]));
}

export async function setNotificationPreference(userId: string, type: NotificationType, delivery: NotificationDeliveryPreference) {
  return prisma.notificationPreference.upsert({
    where: { userId_type: { userId, type } },
    update: { delivery },
    create: { userId, type, delivery },
  });
}
