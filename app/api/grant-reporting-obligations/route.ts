import { ZodError } from "zod";
import { requireReportAdmin } from "@/lib/api/report-auth";
import { apiError, apiSuccess, validationError } from "@/lib/api/responses";
import { createGrantReportingObligation, GrantReportingServiceError } from "@/lib/services/grant-reports";
import { createGrantReportingObligationSchema } from "@/lib/validators/grant-reports";

export async function POST(request: Request) {
  const context = await requireReportAdmin();
  if ("error" in context) return context.error;
  try {
    const input = createGrantReportingObligationSchema.parse(await request.json());
    return apiSuccess(await createGrantReportingObligation(input, context.internalUser.id), 201);
  } catch (error) {
    if (error instanceof ZodError) return validationError(error);
    if (error instanceof GrantReportingServiceError) return apiError(error.message, error.status);
    return apiError("Reporting obligation could not be created.", 500);
  }
}
