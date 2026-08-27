import { ZodError } from "zod";
import { requireReportAdmin } from "@/lib/api/report-auth";
import { apiError, apiSuccess, validationError } from "@/lib/api/responses";
import { createGrantAward, GrantReportingServiceError } from "@/lib/services/grant-reports";
import { createGrantAwardSchema } from "@/lib/validators/grant-reports";

export async function POST(request: Request) {
  const context = await requireReportAdmin();
  if ("error" in context) return context.error;
  try {
    const input = createGrantAwardSchema.parse(await request.json());
    return apiSuccess(await createGrantAward(input, context.internalUser.id), 201);
  } catch (error) {
    if (error instanceof ZodError) return validationError(error);
    if (error instanceof GrantReportingServiceError) return apiError(error.message, error.status);
    return apiError("Grant award could not be created.", 500);
  }
}
