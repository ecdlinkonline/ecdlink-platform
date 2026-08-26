import { NextRequest } from "next/server";
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
import { listFundingCallsFromDb } from "@/lib/repositories/funding";
import { createFundingCall } from "@/lib/services/funding";
import { createFundingCallSchema } from "@/lib/validators/funding";

export async function GET(request: NextRequest) {
  const context = await requireFundingUser();

  if ("error" in context) {
    return context.error;
  }

  return apiSuccess(
    await listFundingCallsFromDb({
      status:
        request.nextUrl.searchParams.get("status") ?? undefined,
      type:
        request.nextUrl.searchParams.get("type") ?? undefined,
    })
  );
}

export async function POST(request: Request) {
  const context = await requireFundingOrganisation();

  if ("error" in context) {
    return context.error;
  }

  const fundingOrganisationIds = context.fundingOrganisationIds;

  try {
    const input = createFundingCallSchema.parse(
      await request.json()
    );

    return apiSuccess(
      await createFundingCall(
        input,
        context.internalUser.id,
        fundingOrganisationIds[0]
      ),
      201
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
      "Funding opportunity could not be created.",
      500
    );
  }
}
