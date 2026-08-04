import type { EmailProviderName, EmailStatus, NotificationDeliveryPreference, NotificationType } from "@prisma/client";

export const emailProviderNames = ["NOOP", "RESEND"] as const satisfies readonly EmailProviderName[];
export type EmailMessage = { to: string; from: string; replyTo?: string; subject: string; html: string; text: string };
export type EmailTemplate = Pick<EmailMessage, "subject" | "html" | "text">;
export type EmailProviderResult = { status: "SENT"; messageId: string } | { status: "SKIPPED"; reason: string };
export type EmailProviderHealth = { healthy: boolean; provider: EmailProviderName; detail?: string };
export type EmailDeliveryJob = { deliveryLogId: string };
export type EmailTemplateInput = { type: NotificationType; title: string; body: string; href?: string | null; recipientName?: string };
export type EmailDeliveryDecision = { preference: NotificationDeliveryPreference; inAppVisible: boolean; emailStatus: EmailStatus | null };

export class EmailProviderError extends Error {
  constructor(message: string, public transient = true) { super(message); }
}
