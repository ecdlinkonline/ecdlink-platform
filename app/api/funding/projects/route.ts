import { ZodError } from "zod";
import { requireFundingCentre } from "@/lib/api/funding-auth";
import {
  apiError,
  apiSuccess,
  statusFromError,
  validationError,
} from "@/lib/api/responses";
import { createCentreFundingProject } from "@/lib/services/funding";
import { createFundingProjectSchema } from "@/lib/validators/funding";

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

  const centreId = centreIds[0];

  if (!centreId) {
    return apiError(
      "No centre ownership was found for this user.",
      403
    );
  }

  try {
    const input = createFundingProjectSchema.parse(
      await request.json()
    );

    return apiSuccess(
      await createCentreFundingProject(
        centreId,
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
      "Funding project could not be created.",
      500
    );
  }
}