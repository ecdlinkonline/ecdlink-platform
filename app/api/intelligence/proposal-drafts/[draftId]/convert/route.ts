import { requireIntelligenceAccess } from "@/lib/api/intelligence-auth";
import { apiError, apiSuccess, statusFromError } from "@/lib/api/responses";
import { convertProposalDraft } from "@/lib/services/intelligence";

export async function POST(_: Request, { params }: { params: Promise<{ draftId: string }> }) {
  const context = await requireIntelligenceAccess();
  if ("error" in context) return context.error;
  try { return apiSuccess(await convertProposalDraft(context.scope, (await params).draftId)); }
  catch (error) { if (error instanceof Error) return apiError(error.message, statusFromError(error)); return apiError("Proposal draft could not be converted.", 500); }
}
