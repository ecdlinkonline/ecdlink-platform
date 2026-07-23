import { ZodError } from "zod";
import { requireIntelligenceAccess } from "@/lib/api/intelligence-auth";
import { apiError, apiSuccess, validationError } from "@/lib/api/responses";
import { prisma } from "@/lib/db/prisma";
import { toPlain } from "@/lib/repositories/intelligence";
import { proposalDraftPatchSchema } from "@/lib/validators/intelligence";

export async function GET(_: Request, { params }: { params: Promise<{ draftId: string }> }) {
  const context = await requireIntelligenceAccess();
  if ("error" in context) return context.error;
  const draft = await prisma.intelligenceProposalDraft.findFirst({ where: context.scope.isPlatformWide ? { id: (await params).draftId } : { id: (await params).draftId, centreId: { in: context.scope.centreIds } } });
  if (!draft) return apiError("Proposal draft was not found.", 404);
  return apiSuccess(toPlain(draft));
}

export async function PATCH(request: Request, { params }: { params: Promise<{ draftId: string }> }) {
  const context = await requireIntelligenceAccess();
  if ("error" in context) return context.error;
  try {
    const draft = await prisma.intelligenceProposalDraft.findFirst({ where: context.scope.isPlatformWide ? { id: (await params).draftId } : { id: (await params).draftId, centreId: { in: context.scope.centreIds } } });
    if (!draft) return apiError("Proposal draft was not found.", 404);
    return apiSuccess(toPlain(await prisma.intelligenceProposalDraft.update({ where: { id: draft.id }, data: proposalDraftPatchSchema.parse(await request.json()) })));
  } catch (error) {
    if (error instanceof ZodError) return validationError(error);
    return apiError("Proposal draft could not be updated.", 500);
  }
}
