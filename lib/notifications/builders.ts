import type { NotificationDraft, FundingNotificationEvent } from "./types";

type FundingContext = { recipientUserIds: string[]; centreId?: string; centreName?: string; applicationId?: string; documentId?: string };

const copy = {
  FUNDING_APPLICATION_SUBMITTED: ["Funding application submitted", "A funding application is ready for review."],
  FUNDING_APPLICATION_CLARIFICATION_REQUESTED: ["Clarification requested", "Additional information has been requested for a funding application."],
  FUNDING_APPLICATION_APPROVED: ["Funding application approved", "A funding application has been approved."],
  FUNDING_APPLICATION_REJECTED: ["Funding application decision", "A funding application has not been approved."],
  FUNDING_APPLICATION_REVIEWER_ASSIGNED: ["Funding review assigned", "You have been assigned to review a funding application."],
  FUNDING_DOCUMENT_RESUBMISSION_REQUESTED: ["Document resubmission requested", "A funding document needs to be resubmitted."],
  FUNDING_DOCUMENT_VERIFIED: ["Funding document verified", "A funding document has been verified."],
  FUNDING_MANUAL_COMMUNICATION: ["Funding update", "A new funding communication is available."],
} as const;

export function buildFundingNotifications(event: FundingNotificationEvent, context: FundingContext): NotificationDraft[] {
  const [title, body] = copy[event.type];
  const entityId = "applicationId" in event ? event.applicationId : event.documentId;
  const href = context.centreId ? `/dashboard/super-admin/funding/${context.centreId}` : undefined;
  return [...new Set(context.recipientUserIds)].filter((id) => id !== event.actorUserId).map((recipientUserId) => ({
    recipientUserId,
    actorUserId: event.actorUserId,
    centreId: context.centreId,
    module: "FUNDING",
    type: event.type,
    title,
    body: context.centreName ? `${body} Centre: ${context.centreName}.` : body,
    href,
    metadata: { entityId },
  }));
}
