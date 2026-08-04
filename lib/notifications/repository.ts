import type { NotificationModule, NotificationType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { NotificationDraft, NotificationListFilters } from "./types";

export async function createNotifications(drafts: NotificationDraft[]) {
  if (!drafts.length) return { count: 0 };
  return prisma.notification.createMany({ data: drafts });
}

export async function listNotificationsForUser(userId: string, filters: NotificationListFilters = {}) {
  const limit = Math.min(Math.max(filters.limit ?? 20, 1), 100);
  const where: Prisma.NotificationWhereInput = {
    recipientUserId: userId,
    inAppVisible: true,
    module: filters.module,
    type: filters.type,
    readAt: filters.read === "READ" ? { not: null } : filters.read === "UNREAD" ? null : undefined,
  };
  const items = await prisma.notification.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
    select: { id: true, module: true, type: true, title: true, body: true, href: true, metadata: true, readAt: true, createdAt: true, emailDelivery: { select: { status: true } } },
  });
  const hasMore = items.length > limit;
  const page = hasMore ? items.slice(0, limit) : items;
  return { items: page, nextCursor: hasMore ? page.at(-1)?.id ?? null : null };
}

export function countUnreadNotificationsForUser(userId: string) {
  return prisma.notification.count({ where: { recipientUserId: userId, inAppVisible: true, readAt: null } });
}

export async function setNotificationReadState(userId: string, notificationId: string, read: boolean) {
  const result = await prisma.notification.updateMany({ where: { id: notificationId, recipientUserId: userId, inAppVisible: true }, data: { readAt: read ? new Date() : null } });
  return result.count === 1;
}

export function markAllNotificationsRead(userId: string, filters: { module?: NotificationModule; type?: NotificationType } = {}) {
  return prisma.notification.updateMany({ where: { recipientUserId: userId, inAppVisible: true, readAt: null, module: filters.module, type: filters.type }, data: { readAt: new Date() } });
}
