import { requireIntelligenceAccess } from "@/lib/api/intelligence-auth";
import { apiError, apiSuccess, statusFromError } from "@/lib/api/responses";
import { convertBudgetDraft } from "@/lib/services/intelligence";

export async function POST(_: Request, { params }: { params: Promise<{ draftId: string }> }) {
  const context = await requireIntelligenceAccess();
  if ("error" in context) return context.error;
  try { return apiSuccess(await convertBudgetDraft(context.scope, (await params).draftId)); }
  catch (error) { if (error instanceof Error) return apiError(error.message, statusFromError(error)); return apiError("Budget draft could not be converted.", 500); }
}
