import type { EmailProviderName, EmailStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export function getEmailDeliveryLog(id: string) {
  return prisma.emailDeliveryLog.findUnique({ where: { id }, include: { notification: { include: { recipient: { select: { email: true, firstName: true, lastName: true } } } } } });
}
export function incrementDeliveryAttempt(id: string) { return prisma.emailDeliveryLog.update({ where: { id }, data: { attempts: { increment: 1 }, status: "PENDING", error: null } }); }
export function markDeliverySent(id: string, providerMessageId: string) { return prisma.emailDeliveryLog.update({ where: { id }, data: { status: "SENT", providerMessageId, error: null, sentAt: new Date() } }); }
export function markDeliverySkipped(id: string, reason: string) { return prisma.emailDeliveryLog.update({ where: { id }, data: { status: "SKIPPED", error: reason.slice(0, 1000) } }); }
export function markDeliveryFailed(id: string, error: string) { return prisma.emailDeliveryLog.update({ where: { id }, data: { status: "FAILED", error: error.slice(0, 1000) } }); }
export type CreateDeliveryLogInput = { notificationId: string; recipient: string; provider: EmailProviderName; status: EmailStatus; error?: string };
