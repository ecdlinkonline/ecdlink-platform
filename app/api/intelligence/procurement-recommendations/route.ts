import { ZodError } from "zod";
import { requireIntelligenceAccess } from "@/lib/api/intelligence-auth";
import { apiError, apiSuccess, validationError } from "@/lib/api/responses";
import { getProcurementRecommendations } from "@/lib/services/intelligence";
import { procurementRecommendationSchema } from "@/lib/validators/intelligence";

export async function GET(request: Request) {
  const context = await requireIntelligenceAccess();
  if ("error" in context) return context.error;
  try { return apiSuccess(await getProcurementRecommendations(context.scope, procurementRecommendationSchema.parse(Object.fromEntries(new URL(request.url).searchParams.entries())))); }
  catch (error) { if (error instanceof ZodError) return validationError(error); return apiError("Procurement recommendation could not be generated.", 500); }
}
