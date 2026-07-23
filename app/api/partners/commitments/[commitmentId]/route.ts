import { requirePartnerOwnership } from "@/lib/api/partner-auth";
import { apiError, apiSuccess } from "@/lib/api/responses";
import { prisma } from "@/lib/db/prisma";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ commitmentId: string }> }
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

  const { commitmentId } = await params;

  const commitment =
    await prisma.sponsorshipCommitment.findUnique({
      where: {
        id: commitmentId,
      },
      include: {
        donor: true,
        project: true,
      },
    });

  if (!commitment) {
    return apiError("Commitment was not found.", 404);
  }

  if (
    context.authContext.role === "donor" &&
    !partnerIds.includes(commitment.donorOrganisationId)
  ) {
    return apiError(
      "You can only access your organisation commitments.",
      403
    );
  }

  if (
    context.authContext.role === "ecd_centre" &&
    !centreIds.includes(commitment.centreId)
  ) {
    return apiError(
      "You can only access your centre commitments.",
      403
    );
  }

  return apiSuccess(commitment);
}