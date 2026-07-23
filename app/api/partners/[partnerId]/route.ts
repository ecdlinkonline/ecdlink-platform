import { ZodError } from "zod";
import {
  canAccessPartner,
  requirePartnerOwnership,
} from "@/lib/api/partner-auth";
import {
  apiError,
  apiSuccess,
  statusFromError,
  validationError,
} from "@/lib/api/responses";
import { prisma } from "@/lib/db/prisma";
import { resolvePartnerDbId } from "@/lib/repositories/donors";
import { createAuditLog } from "@/lib/repositories/audit-logs";
import { partnerOrganisationSchema } from "@/lib/validators/partners";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ partnerId: string }> }
) {
  const context = await requirePartnerOwnership();

  if ("error" in context) {
    return context.error;
  }

  const partnerIds =
    "partnerIds" in context
      ? context.partnerIds
      : context.internalUser.donorUsers.map(
          (membership) => membership.donorOrganisationId
        );

  const accessContext = {
    authContext: context.authContext,
    partnerIds,
  };

  const { partnerId } = await params;
  const dbId = await resolvePartnerDbId(partnerId);

  if (!dbId) {
    return apiError(
      "Partner organisation was not found.",
      404
    );
  }

  if (!canAccessPartner(accessContext, dbId)) {
    return apiError(
      "You can only access your linked partner organisation.",
      403
    );
  }

  return apiSuccess(
    await prisma.donorOrganisation.findUnique({
      where: {
        id: dbId,
      },
      include: {
        users: true,
        engagements: true,
      },
    })
  );
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ partnerId: string }> }
) {
  const context = await requirePartnerOwnership(
    "partner.manage"
  );

  if ("error" in context) {
    return context.error;
  }

  const partnerIds =
    "partnerIds" in context
      ? context.partnerIds
      : context.internalUser.donorUsers.map(
          (membership) => membership.donorOrganisationId
        );

  const accessContext = {
    authContext: context.authContext,
    partnerIds,
  };

  try {
    const { partnerId } = await params;
    const dbId = await resolvePartnerDbId(partnerId);

    if (!dbId) {
      return apiError(
        "Partner organisation was not found.",
        404
      );
    }

    if (!canAccessPartner(accessContext, dbId)) {
      return apiError(
        "You can only update your linked partner organisation.",
        403
      );
    }

    const before =
      await prisma.donorOrganisation.findUnique({
        where: {
          id: dbId,
        },
      });

    const input = partnerOrganisationSchema
      .partial()
      .parse(await request.json());

    const {
      organisationName,
      organisationType,
      annualSupportBudget,
      ...remainingInput
    } = input;

    const after = await prisma.donorOrganisation.update({
      where: {
        id: dbId,
      },
      data: {
        ...remainingInput,
        ...(organisationName !== undefined
          ? { name: organisationName }
          : {}),
        ...(organisationType !== undefined
          ? { type: organisationType }
          : {}),
        ...(annualSupportBudget !== undefined
          ? {
              annualSupportBudget:
                annualSupportBudget.toFixed(2),
            }
          : {}),
      },
    });

    await createAuditLog({
      actorUserId: context.internalUser.id,
      action: "partner.profile.update",
      entityType: "DonorOrganisation",
      entityId: dbId,
      before,
      after,
    });

    return apiSuccess(after);
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
      "Partner organisation could not be updated.",
      500
    );
  }
}