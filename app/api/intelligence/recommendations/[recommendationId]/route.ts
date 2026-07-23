import { ZodError } from "zod";
import { requireIntelligenceAccess } from "@/lib/api/intelligence-auth";
import { apiError, apiSuccess, statusFromError, validationError } from "@/lib/api/responses";
import { findScopedRecommendation } from "@/lib/repositories/intelligence";
import { updateRecommendationStatus } from "@/lib/services/intelligence";
import { recommendationPatchSchema } from "@/lib/validators/intelligence";

export async function GET(_: Request, { params }: { params: Promise<{ recommendationId: string }> }) {
  const context = await requireIntelligenceAccess();
  if ("error" in context) return context.error;
  const recommendation = await findScopedRecommendation(context.scope, (await params).recommendationId);
  if (!recommendation) return apiError("Recommendation was not found.", 404);
  return apiSuccess(recommendation);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ recommendationId: string }> }) {
  const context = await requireIntelligenceAccess();
  if ("error" in context) return context.error;
  try {
    const body = recommendationPatchSchema.parse(await request.json());
    if (!body.status) return apiError("No recommendation status supplied.", 422);
    return apiSuccess(await updateRecommendationStatus(context.scope, (await params).recommendationId, body.status));
  } catch (error) {
    if (error instanceof ZodError) return validationError(error);
    if (error instanceof Error) return apiError(error.message, statusFromError(error));
    return apiError("Recommendation could not be updated.", 500);
  }
}
