import { ZodError } from "zod";
import { requireFundingOrganisation } from "@/lib/api/funding-auth";
import {
  apiError,
  apiSuccess,
  statusFromError,
  validationError,
} from "@/lib/api/responses";
import { prisma } from "@/lib/db/prisma";
import { createFundingAssessment } from "@/lib/services/funding";
import { createAssessmentSchema } from "@/lib/validators/funding";

export async function GET() {
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

  if (context.authContext.role === "super_admin") {
    return apiSuccess(
      await prisma.fundingAssessment.findMany({
        include: {
          call: true,
          application: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      })
    );
  }

  return apiSuccess(
    await prisma.fundingAssessment.findMany({
      where: {
        fundingOrganisationId: {
          in: fundingOrganisationIds,
        },
      },
      include: {
        call: true,
        application: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    })
  );
}

export async function POST(request: Request) {
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
    const input = createAssessmentSchema.parse(
      await request.json()
    );

    if (context.authContext.role === "funding_partner") {
      const call = await prisma.fundingCall.findUnique({
        where: {
          id: input.fundingCallId,
        },
      });

      if (
        !call ||
        !fundingOrganisationIds.includes(
          call.fundingOrganisationId
        )
      ) {
        return apiError(
          "You can only assess calls owned by your funding organisation.",
          403
        );
      }
    }

    return apiSuccess(
      await createFundingAssessment(
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
      "Funding assessment could not be created.",
      500
    );
  }
}