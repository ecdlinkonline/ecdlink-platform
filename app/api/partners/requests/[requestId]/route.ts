import { ZodError } from "zod";
import { requirePartnerOwnership } from "@/lib/api/partner-auth";
import {
  apiError,
  apiSuccess,
  statusFromError,
  validationError,
} from "@/lib/api/responses";
import { prisma } from "@/lib/db/prisma";
import { setPartnershipRequestStatus } from "@/lib/services/partners";
import { requestStatusSchema } from "@/lib/validators/partners";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ requestId: string }> }
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

  const { requestId } = await params;

  const partnershipRequest =
    await prisma.partnershipRequest.findUnique({
      where: {
        id: requestId,
      },
      include: {
        donor: true,
        project: true,
        commitments: true,
      },
    });

  if (!partnershipRequest) {
    return apiError(
      "Partnership request was not found.",
      404
    );
  }

  if (
    context.authContext.role === "donor" &&
    !partnerIds.includes(
      partnershipRequest.donorOrganisationId
    )
  ) {
    return apiError(
      "You can only access your organisation requests.",
      403
    );
  }

  if (
    context.authContext.role === "ecd_centre" &&
    (
      !partnershipRequest.centreId ||
      !centreIds.includes(partnershipRequest.centreId)
    )
  ) {
    return apiError(
      "You can only access your centre requests.",
      403
    );
  }

  return apiSuccess(partnershipRequest);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const context = await requirePartnerOwnership(
    "requests.manage"
  );

  if ("error" in context) {
    return context.error;
  }

  try {
    const { requestId } = await params;

    const input = requestStatusSchema.parse(
      await request.json()
    );

    return apiSuccess(
      await setPartnershipRequestStatus(
        requestId,
        input.status,
        context.internalUser.id,
        input.notes
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
      "Partnership request could not be updated.",
      500
    );
  }
}