import { requireFundingOrganisation } from "@/lib/api/funding-auth";
import {
  apiError,
  apiSuccess,
  statusFromError,
} from "@/lib/api/responses";
import { getFundingCallFromDb } from "@/lib/repositories/funding";
import { archiveFundingCall } from "@/lib/services/funding";

export async function POST(
  _: Request,
  { params }: { params: Promise<{ opportunityId: string }> }
) {
  const context = await requireFundingOrganisation();

  if ("error" in context) {
    return context.error;
  }

  const fundingOrganisationIds =
    "fundingOrganisationIds" in context
      ? context.fundingOrganisationIds
      : context.internalUser.fundingUsers.map(
          (membership) => membership.fundingOrganisationId
        );

  try {
    const { opportunityId } = await params;

    const existing = await getFundingCallFromDb(opportunityId);

    if (!existing) {
      return apiError(
        "Funding opportunity was not found.",
        404
      );
    }

    if (
      context.authContext.role === "funding_partner" &&
      !fundingOrganisationIds.includes(
        existing.fundingOrganisationId
      )
    ) {
      return apiError(
        "You can only archive opportunities owned by your funding organisation.",
        403
      );
    }

    return apiSuccess(
      await archiveFundingCall(
        opportunityId,
        context.internalUser.id
      )
    );
  } catch (error) {
    if (error instanceof Error) {
      return apiError(
        error.message,
        statusFromError(error)
      );
    }

    return apiError(
      "Funding opportunity could not be archived.",
      500
    );
  }
}