import { ZodError } from "zod";
import { requirePartnerOwnership } from "@/lib/api/partner-auth";
import {
  apiError,
  apiSuccess,
  statusFromError,
  validationError,
} from "@/lib/api/responses";
import { listPartnershipRequestsFromDb } from "@/lib/repositories/donors";
import { createPartnershipRequest } from "@/lib/services/partners";
import { partnershipRequestSchema } from "@/lib/validators/partners";

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
    await listPartnershipRequestsFromDb(
      partnerIds.length > 0 ? partnerIds : undefined,
      centreIds.length > 0 ? centreIds : undefined
    )
  );
}

export async function POST(request: Request) {
  const context = await requirePartnerOwnership(
    "requests.manage"
  );

  if ("error" in context) {
    return context.error;
  }

  const partnerIds =
    ("partnerIds" in context ? context.partnerIds : null) ??
    context.internalUser.donorUsers.map(
      (membership) => membership.donorOrganisationId
    );

  const partnerId = partnerIds[0];

  if (!partnerId) {
    return apiError(
      "Partner organisation ownership is required.",
      403
    );
  }

  try {
    const input = partnershipRequestSchema.parse(
      await request.json()
    );

    return apiSuccess(
      await createPartnershipRequest(
        partnerId,
        input,
        context.internalUser.id
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
      "Partnership request could not be submitted.",
      500
    );
  }
}