import { requirePartnerOwnership } from "@/lib/api/partner-auth";
import { apiError, apiSuccess } from "@/lib/api/responses";
import { prisma } from "@/lib/db/prisma";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ reportId: string }> }
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

  const { reportId } = await params;

  const report = await prisma.impactReport.findUnique({
    where: {
      id: reportId,
    },
    include: {
      centre: true,
      project: true,
      donor: true,
    },
  });

  if (!report) {
    return apiError("Impact report was not found.", 404);
  }

  if (
    context.authContext.role === "donor" &&
    (
      !report.donorOrganisationId ||
      !partnerIds.includes(report.donorOrganisationId)
    )
  ) {
    return apiError(
      "You can only access reports for your organisation.",
      403
    );
  }

  if (
    context.authContext.role === "ecd_centre" &&
    (
      !report.centreId ||
      !centreIds.includes(report.centreId)
    )
  ) {
    return apiError(
      "You can only access reports for your centre.",
      403
    );
  }

  return apiSuccess(report);
}