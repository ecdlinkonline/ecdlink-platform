import { requireIntelligenceAccess } from "@/lib/api/intelligence-auth";
import { apiError, apiSuccess, statusFromError } from "@/lib/api/responses";
import { updateInsightStatus } from "@/lib/services/intelligence";

export async function POST(_: Request, { params }: { params: Promise<{ insightId: string }> }) {
  const context = await requireIntelligenceAccess();
  if ("error" in context) return context.error;
  try { return apiSuccess(await updateInsightStatus(context.scope, (await params).insightId, "DISMISSED")); }
  catch (error) { if (error instanceof Error) return apiError(error.message, statusFromError(error)); return apiError("Insight could not be dismissed.", 500); }
}
