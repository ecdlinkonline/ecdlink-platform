import { ZodError } from "zod";
import { requireReportAdmin } from "@/lib/api/report-auth";
import { requireTrustedOrigin } from "@/lib/api/security";
import { apiError, apiSuccess, validationError } from "@/lib/api/responses";
import { createNextGrantReportingPeriod, GrantReportingServiceError } from "@/lib/services/grant-reports";
import { createNextGrantReportingPeriodSchema } from "@/lib/validators/grant-reports";

export async function POST(request: Request, { params }: { params: Promise<{ obligationId: string }> }) {
  const context = await requireReportAdmin();
  if ("error" in context) return context.error;
  const originError = requireTrustedOrigin(request);
  if (originError) return originError;
  try {
    const { obligationId } = await params;
    const input = createNextGrantReportingPeriodSchema.parse(await request.json());
    return apiSuccess(await createNextGrantReportingPeriod(obligationId, input.grantAwardId, input.dueAt, context.internalUser.id), 201);
  } catch (error) {
    if (error instanceof ZodError) return validationError(error);
    if (error instanceof GrantReportingServiceError) return apiError(error.message, error.status, error.details);
    return apiError("The next reporting period could not be created.", 500);
  }
}
