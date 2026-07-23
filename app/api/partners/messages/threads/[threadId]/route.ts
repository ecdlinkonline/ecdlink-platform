import { requirePartnerOwnership } from "@/lib/api/partner-auth";
import { apiError, apiSuccess } from "@/lib/api/responses";
import { prisma } from "@/lib/db/prisma";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ threadId: string }> }
) {
  const context = await requirePartnerOwnership();

  if ("error" in context) {
    return context.error;
  }

  const partnerIds =
    ("partnerIds" in context ? context.partnerIds : null) ??
    context.internalUser.donorUsers.map(
      (membership) => membership.donorOrganisationId
    );

  const centreIds =
    ("centreIds" in context ? context.centreIds : null) ??
    context.internalUser.centreUsers.map(
      (ownership) => ownership.centreId
    );

  const { threadId } = await params;

  const thread = await prisma.messageThread.findUnique({
    where: {
      id: threadId,
    },
    include: {
      donor: true,
      centre: true,
      messages: {
        orderBy: {
          createdAt: "asc",
        },
      },
    },
  });

  if (!thread) {
    return apiError("Message thread was not found.", 404);
  }

  if (
    context.authContext.role === "donor" &&
    (
      !thread.donorOrganisationId ||
      !partnerIds.includes(thread.donorOrganisationId)
    )
  ) {
    return apiError(
      "You can only access your organisation conversations.",
      403
    );
  }

  if (
    context.authContext.role === "ecd_centre" &&
    (
      !thread.centreId ||
      !centreIds.includes(thread.centreId)
    )
  ) {
    return apiError(
      "You can only access your centre conversations.",
      403
    );
  }

  return apiSuccess(thread);
}