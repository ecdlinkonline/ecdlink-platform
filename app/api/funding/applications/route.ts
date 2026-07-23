import { ZodError } from "zod";
import { requireFundingCentre, requireFundingUser } from "@/lib/api/funding-auth";
import { apiError, apiSuccess, statusFromError, validationError } from "@/lib/api/responses";
import { prisma } from "@/lib/db/prisma";
import { createFundingApplication } from "@/lib/services/funding";
import { createFundingApplicationSchema } from "@/lib/validators/funding";

export async function GET() {
  const context = await requireFundingUser();
  if ("error" in context) return context.error;

  if (context.authContext.role === "ecd_centre") {
    const centreIds = context.internalUser.centreUsers.map((ownership) => ownership.centreId);
    return apiSuccess(await prisma.fundingApplication.findMany({
      where: { project: { profile: { centreId: { in: centreIds } } } },
      include: { project: true, fundingCall: true, assessments: true },
      orderBy: { createdAt: "desc" }
    }));
  }

  if (context.authContext.role === "funding_partner") {
    const fundingOrganisationIds = context.internalUser.fundingUsers.map((membership) => membership.fundingOrganisationId);
    return apiSuccess(await prisma.fundingApplication.findMany({
      where: { fundingOrganisationId: { in: fundingOrganisationIds } },
      include: { project: { include: { profile: { include: { centre: true } } } }, fundingCall: true, assessments: true },
      orderBy: { createdAt: "desc" }
    }));
  }

  if (context.authContext.role !== "super_admin") return apiError("You do not have access to funding applications.", 403);
  return apiSuccess(await prisma.fundingApplication.findMany({
    include: { project: { include: { profile: { include: { centre: true } } } }, fundingCall: true, assessments: true },
    orderBy: { createdAt: "desc" }
  }));
}

export async function POST(request: Request) {
  const context = await requireFundingCentre();

  if ("error" in context) {
    return context.error;
  }

  const centreIds =
    "centreIds" in context
      ? context.centreIds
      : context.internalUser.centreUsers.map(
          (ownership) => ownership.centreId
        );

  try {
    const input = createFundingApplicationSchema.parse(
      await request.json()
    );

    return apiSuccess(
      await createFundingApplication(
        input,
        centreIds,
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
      "Funding application could not be submitted.",
      500
    );
  }
}