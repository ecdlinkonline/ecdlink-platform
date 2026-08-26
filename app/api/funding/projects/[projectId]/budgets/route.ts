import { ZodError } from "zod";
import {
  requireFundingCentre,
  requireFundingUser,
} from "@/lib/api/funding-auth";
import {
  apiError,
  apiSuccess,
  statusFromError,
  validationError,
} from "@/lib/api/responses";
import { prisma } from "@/lib/db/prisma";
import { getFundingProjectForOwnedCentre } from "@/lib/repositories/funding";
import { createProjectBudget } from "@/lib/services/funding";
import { createBudgetSchema } from "@/lib/validators/funding";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const context = await requireFundingUser();

  if ("error" in context) {
    return context.error;
  }

  const { projectId } = await params;

  if (context.authContext.role === "ecd_centre") {
    const centreIds = context.internalUser.centreUsers.map(
      (ownership) => ownership.centreId
    );

    const project = await getFundingProjectForOwnedCentre(
      projectId,
      centreIds
    );

    if (!project) {
      return apiError(
        "Funding project was not found for the current centre.",
        404
      );
    }
  } else if (
    !["super_admin", "funding_partner"].includes(
      context.authContext.role ?? ""
    )
  ) {
    return apiError(
      "You do not have access to funding budgets.",
      403
    );
  }

  return apiSuccess(
    await prisma.budget.findMany({
      where: {
        projectId,
      },
      include: {
        items: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    })
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const context = await requireFundingCentre();

  if ("error" in context) {
    return context.error;
  }

  const centreIds = context.centreIds;

  try {
    const { projectId } = await params;

    const project = await getFundingProjectForOwnedCentre(
      projectId,
      centreIds
    );

    if (!project) {
      return apiError(
        "Funding project was not found for the current centre.",
        404
      );
    }

    const input = createBudgetSchema.parse(
      await request.json()
    );

    return apiSuccess(
      await createProjectBudget(
        projectId,
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
      "Funding budget could not be created.",
      500
    );
  }
}
