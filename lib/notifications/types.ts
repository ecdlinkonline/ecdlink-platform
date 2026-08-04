import type { NotificationDeliveryPreference, NotificationModule, NotificationType, Prisma } from "@prisma/client";

export const notificationModules = ["FUNDING", "COMPLIANCE", "PROCUREMENT", "MEMBERSHIP", "SUPPLIERS", "CENTRES", "PARTNERS", "PLATFORM"] as const satisfies readonly NotificationModule[];
export const notificationTypes = ["FUNDING_APPLICATION_SUBMITTED", "FUNDING_APPLICATION_CLARIFICATION_REQUESTED", "FUNDING_APPLICATION_APPROVED", "FUNDING_APPLICATION_REJECTED", "FUNDING_APPLICATION_REVIEWER_ASSIGNED", "FUNDING_DOCUMENT_RESUBMISSION_REQUESTED", "FUNDING_DOCUMENT_VERIFIED", "FUNDING_MANUAL_COMMUNICATION", "PLATFORM_GENERAL"] as const satisfies readonly NotificationType[];
export const notificationDeliveryPreferences = ["EMAIL", "IN_APP", "BOTH", "NONE"] as const satisfies readonly NotificationDeliveryPreference[];

export type NotificationReadFilter = "ALL" | "READ" | "UNREAD";

export type NotificationDraft = {
  recipientUserId: string;
  actorUserId?: string;
  centreId?: string;
  module: NotificationModule;
  type: NotificationType;
  title: string;
  body: string;
  href?: string;
  metadata?: Prisma.InputJsonValue;
};

export type NotificationListFilters = {
  module?: NotificationModule;
  type?: NotificationType;
  read?: NotificationReadFilter;
  cursor?: string;
  limit?: number;
};

export type FundingNotificationEvent =
  | { type: "FUNDING_APPLICATION_SUBMITTED"; applicationId: string; actorUserId: string }
  | { type: "FUNDING_APPLICATION_REVIEWER_ASSIGNED"; applicationId: string; actorUserId: string; reviewerUserId: string }
  | { type: "FUNDING_APPLICATION_CLARIFICATION_REQUESTED" | "FUNDING_APPLICATION_APPROVED" | "FUNDING_APPLICATION_REJECTED"; applicationId: string; actorUserId: string }
  | { type: "FUNDING_DOCUMENT_RESUBMISSION_REQUESTED" | "FUNDING_DOCUMENT_VERIFIED"; documentId: string; actorUserId: string }
  | { type: "FUNDING_MANUAL_COMMUNICATION"; applicationId: string; actorUserId: string };
