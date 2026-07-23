import { ZodError } from "zod";
import { requirePartnerOwnership } from "@/lib/api/partner-auth";
import {
  apiError,
  apiSuccess,
  statusFromError,
  validationError,
} from "@/lib/api/responses";
import { prisma } from "@/lib/db/prisma";
import { createCommitment } from "@/lib/services/partners";
import { commitmentSchema } from "@/lib/validators/partners";

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

  const where =
    context.authContext.role === "donor"
      ? {
          donorOrganisationId: {
            in: partnerIds,
          },
        }
      : context.authContext.role === "ecd_centre"
        ? {
            centreId: {
              in: centreIds,
            },
          }
        : undefined;

  return apiSuccess(
    await prisma.sponsorshipCommitment.findMany({
      where,
      include: {
        donor: true,
        project: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    })
  );
}

export async function POST(request: Request) {
  const context = await requirePartnerOwnership(
    "commitments.manage"
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
    const input = commitmentSchema.parse(
      await request.json()
    );

    return apiSuccess(
      await createCommitment(
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
      "Commitment could not be created.",
      500
    );
  }
}