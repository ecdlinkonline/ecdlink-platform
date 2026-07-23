import { ZodError } from "zod";
import { requireIntelligenceAccess } from "@/lib/api/intelligence-auth";
import { apiError, apiSuccess, statusFromError, validationError } from "@/lib/api/responses";
import { findScopedInsight } from "@/lib/repositories/intelligence";
import { updateInsightStatus } from "@/lib/services/intelligence";
import { insightPatchSchema } from "@/lib/validators/intelligence";

export async function GET(_: Request, { params }: { params: Promise<{ insightId: string }> }) {
  const context = await requireIntelligenceAccess();
  if ("error" in context) return context.error;
  const insight = await findScopedInsight(context.scope, (await params).insightId);
  if (!insight) return apiError("Insight was not found.", 404);
  return apiSuccess(insight);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ insightId: string }> }) {
  const context = await requireIntelligenceAccess();
  if ("error" in context) return context.error;
  try {
    const body = insightPatchSchema.parse(await request.json());
    if (!body.status) return apiError("No insight status supplied.", 422);
    return apiSuccess(await updateInsightStatus(context.scope, (await params).insightId, body.status));
  } catch (error) {
    if (error instanceof ZodError) return validationError(error);
    if (error instanceof Error) return apiError(error.message, statusFromError(error));
    return apiError("Insight could not be updated.", 500);
  }
}
