import { ZodError } from "zod";
import {
  requireFundingOrganisation,
  requireFundingUser,
} from "@/lib/api/funding-auth";
import {
  apiError,
  apiSuccess,
  statusFromError,
  validationError,
} from "@/lib/api/responses";
import { getFundingCallFromDb } from "@/lib/repositories/funding";
import { updateFundingCall } from "@/lib/services/funding";
import { updateFundingCallSchema } from "@/lib/validators/funding";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ opportunityId: string }> }
) {
  const context = await requireFundingUser();

  if ("error" in context) {
    return context.error;
  }

  const { opportunityId } = await params;
  const call = await getFundingCallFromDb(opportunityId);

  if (!call) {
    return apiError("Funding opportunity was not found.", 404);
  }

  return apiSuccess(call);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ opportunityId: string }> }
) {
  const context = await requireFundingOrganisation();

  if ("error" in context) {
    return context.error;
  }

  const fundingOrganisationIds = context.fundingOrganisationIds;

  try {
    const { opportunityId } = await params;

    const existing = await getFundingCallFromDb(opportunityId);

    if (!existing) {
      return apiError("Funding opportunity was not found.", 404);
    }

    if (
      context.authContext.role === "funding_partner" &&
      !fundingOrganisationIds.includes(
        existing.fundingOrganisationId
      )
    ) {
      return apiError(
        "You can only update opportunities owned by your funding organisation.",
        403
      );
    }

    const input = updateFundingCallSchema.parse(
      await request.json()
    );

    return apiSuccess(
      await updateFundingCall(
        opportunityId,
        input,
        context.internalUser.id
      )
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return validationError(error);
    }

    if (error instanceof Error) {
      return apiError(
        error.message,
        statusFromError(error)
      );
    }

    return apiError(
      "Funding opportunity could not be updated.",
      500
    );
  }
}
