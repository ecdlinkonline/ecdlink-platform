import { requirePartnerOwnership } from "@/lib/api/partner-auth";
import { apiSuccess } from "@/lib/api/responses";
import { getDonorReportsFromDb } from "@/lib/repositories/donors";

export async function GET() {
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

  return apiSuccess(
    await getDonorReportsFromDb({
      partnerOrganisationIds:
        partnerIds.length > 0 ? partnerIds : undefined,
      centreIds:
        centreIds.length > 0 ? centreIds : undefined,
    })
  );
}