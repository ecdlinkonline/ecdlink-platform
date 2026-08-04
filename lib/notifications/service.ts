import { prisma } from "@/lib/db/prisma";
import { buildFundingNotifications } from "./builders";
import { createNotifications } from "./repository";
import { DEFAULT_NOTIFICATION_PREFERENCE, getPreferenceMap, includesInAppDelivery } from "./preferences";
import type { FundingNotificationEvent } from "./types";

export async function publishFundingNotification(event: FundingNotificationEvent) {
  try {
    if (event.type === "FUNDING_APPLICATION_REVIEWER_ASSIGNED") {
      const application = await prisma.fundingApplication.findUnique({ where: { id: event.applicationId }, select: { project: { select: { profile: { select: { centreId: true, centre: { select: { centreName: true } } } } } } } });
      if (!application) return { count: 0 };
      return deliver(event, [event.reviewerUserId], application.project.profile.centreId, application.project.profile.centre.centreName);
    }

    if ("applicationId" in event) {
      const application = await prisma.fundingApplication.findUnique({
        where: { id: event.applicationId },
        select: { createdByUserId: true, fundingOrganisationId: true, project: { select: { profile: { select: { centreId: true, centre: { select: { centreName: true, users: { where: { status: "ACTIVE", user: { status: "ACTIVE" } }, select: { userId: true } } } } } } } } },
      });
      if (!application) return { count: 0 };
      const recipients = event.type === "FUNDING_APPLICATION_SUBMITTED"
        ? await prisma.user.findMany({ where: { status: "ACTIVE", OR: [{ role: "SUPER_ADMIN" }, ...(application.fundingOrganisationId ? [{ role: "FUNDING_ORGANISATION" as const, fundingUsers: { some: { fundingOrganisationId: application.fundingOrganisationId } } }] : [])] }, select: { id: true } }).then((rows) => rows.map((row) => row.id))
        : [application.createdByUserId, ...application.project.profile.centre.users.map((membership) => membership.userId)].filter((id): id is string => Boolean(id));
      return deliver(event, recipients, application.project.profile.centreId, application.project.profile.centre.centreName);
    }

    const document = await prisma.fundingSupportingDocument.findUnique({
      where: { id: event.documentId },
      select: {
        profile: {
          select: {
            centreId: true,
            centre: {
              select: {
                centreName: true,
                users: {
                  where: { status: "ACTIVE", user: { status: "ACTIVE" } },
                  select: { userId: true },
                },
              },
            },
          },
        },
      },
    });
    if (!document) return { count: 0 };
    return deliver(event, document.profile.centre.users.map((membership) => membership.userId), document.profile.centreId, document.profile.centre.centreName);
  } catch (error) {
    console.error("Funding notification delivery failed.", error);
    return { count: 0 };
  }
}

async function deliver(event: FundingNotificationEvent, recipientUserIds: string[], centreId: string, centreName: string) {
  const activeRecipients = await prisma.user.findMany({ where: { id: { in: [...new Set(recipientUserIds)] }, status: "ACTIVE" }, select: { id: true } });
  const preferences = await getPreferenceMap(activeRecipients.map((user) => user.id), event.type);
  const eligible = activeRecipients.filter((user) => includesInAppDelivery(preferences.get(user.id) ?? DEFAULT_NOTIFICATION_PREFERENCE)).map((user) => user.id);
  return createNotifications(buildFundingNotifications(event, { recipientUserIds: eligible, centreId, centreName, ...( "applicationId" in event ? { applicationId: event.applicationId } : { documentId: event.documentId }) }));
}
