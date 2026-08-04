import type { NotificationDeliveryPreference } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { NotificationDraft } from "@/lib/notifications/types";
import { buildEmailTemplate } from "./builders/funding";
import { getEmailConfig, type EmailConfig } from "./config";
import { getEmailDeliveryLog, incrementDeliveryAttempt, markDeliveryFailed, markDeliverySent, markDeliverySkipped } from "./delivery";
import { ImmediateEmailQueue, exponentialBackoffMs, type EmailQueue } from "./queue";
import { NoopEmailProvider } from "./providers/noop-provider";
import type { EmailProvider } from "./providers/provider";
import { ResendEmailProvider } from "./providers/resend-provider";
import { EmailProviderError, type EmailDeliveryDecision, type EmailDeliveryJob } from "./types";

export function decideEmailDelivery(preference: NotificationDeliveryPreference): EmailDeliveryDecision {
  return { preference, inAppVisible: preference === "BOTH" || preference === "IN_APP", emailStatus: preference === "NONE" ? null : preference === "BOTH" || preference === "EMAIL" ? "PENDING" : "SKIPPED" };
}
export function createEmailProvider(config: EmailConfig = getEmailConfig()): EmailProvider { return config.provider === "RESEND" ? new ResendEmailProvider(config) : new NoopEmailProvider(); }

export async function deliverEmail(job: EmailDeliveryJob, dependencies: { config?: EmailConfig; provider?: EmailProvider } = {}) {
  const config = dependencies.config ?? getEmailConfig(), provider = dependencies.provider ?? createEmailProvider(config);
  const delivery = await getEmailDeliveryLog(job.deliveryLogId); if (!delivery || !["PENDING", "FAILED"].includes(delivery.status)) return;
  const recipient = delivery.notification.recipient?.email?.trim() || delivery.recipient.trim();
  if (!recipient) { await markDeliverySkipped(delivery.id, "Recipient has no email address."); return; }
  const template = buildEmailTemplate({ type: delivery.notification.type, title: delivery.notification.title, body: delivery.notification.body, href: delivery.notification.href, recipientName: [delivery.notification.recipient?.firstName, delivery.notification.recipient?.lastName].filter(Boolean).join(" ") }, config.baseUrl);
  if (!template) { await markDeliverySkipped(delivery.id, "No email template is registered for this notification type."); return; }
  for (let attempt = delivery.attempts + 1; attempt <= config.maxAttempts; attempt++) {
    await incrementDeliveryAttempt(delivery.id);
    try {
      const result = await provider.send({ to: recipient, from: config.from, replyTo: config.replyTo, ...template });
      if (result.status === "SKIPPED") await markDeliverySkipped(delivery.id, result.reason); else await markDeliverySent(delivery.id, result.messageId);
      return;
    } catch (error) {
      const transient = error instanceof EmailProviderError ? error.transient : true;
      const message = error instanceof Error ? error.message : "Email provider failed.";
      if (!transient || attempt >= config.maxAttempts) { await markDeliveryFailed(delivery.id, message); return; }
      exponentialBackoffMs(attempt); // The immediate queue records policy but deliberately does not sleep; future queues schedule this delay.
    }
  }
}

export async function persistAndScheduleNotificationEmail(input: { draft: NotificationDraft; email: string | null; preference: NotificationDeliveryPreference }, queue?: EmailQueue) {
  const decision = decideEmailDelivery(input.preference); if (!decision.emailStatus) return null;
  const config = getEmailConfig();
  const notification = await prisma.notification.create({ data: { ...input.draft, inAppVisible: decision.inAppVisible, emailDelivery: { create: { recipient: input.email?.trim() ?? "", provider: config.provider, status: decision.emailStatus, ...(decision.emailStatus === "SKIPPED" ? { error: "Email disabled by notification preference." } : {}) } } }, include: { emailDelivery: true } });
  if (notification.emailDelivery?.status === "PENDING") {
    try { await (queue ?? new ImmediateEmailQueue((job) => deliverEmail(job))).enqueue({ deliveryLogId: notification.emailDelivery.id }); }
    catch (error) { await markDeliveryFailed(notification.emailDelivery.id, error instanceof Error ? error.message : "Email queue failed."); }
  }
  return notification;
}
