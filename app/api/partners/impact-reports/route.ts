import { ZodError } from "zod";
import { requirePartnerOwnership } from "@/lib/api/partner-auth";
import {
  apiError,
  apiSuccess,
  statusFromError,
  validationError,
} from "@/lib/api/responses";
import { prisma } from "@/lib/db/prisma";
import { createImpactReport } from "@/lib/services/partners";
import { impactReportSchema } from "@/lib/validators/partners";

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
          visibility: {
            in: ["Partner", "Public"],
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
    await prisma.impactReport.findMany({
      where,
      include: {
        centre: true,
        project: true,
        donor: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    })
  );
}

export async function POST(request: Request) {
  const context = await requirePartnerOwnership(
    "reports.read"
  );

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

  try {
    const input = impactReportSchema.parse(
      await request.json()
    );

    const securedInput = {
      ...input,
      donorOrganisationId:
        context.authContext.role === "donor"
          ? partnerIds[0]
          : input.donorOrganisationId,
      centreId:
        context.authContext.role === "ecd_centre"
          ? centreIds[0]
          : input.centreId,
    };

    return apiSuccess(
      await createImpactReport(
        securedInput,
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
      "Impact report could not be created.",
      500
    );
  }
}