import { ZodError } from "zod";
import { requireIntelligenceAccess } from "@/lib/api/intelligence-auth";
import { apiError, apiSuccess, statusFromError, validationError } from "@/lib/api/responses";
import { prisma } from "@/lib/db/prisma";
import { toPlain } from "@/lib/repositories/intelligence";
import { createProposalDraft } from "@/lib/services/intelligence";
import { proposalDraftSchema } from "@/lib/validators/intelligence";

export async function GET() {
  const context = await requireIntelligenceAccess();
  if ("error" in context) return context.error;
  return apiSuccess(toPlain(await prisma.intelligenceProposalDraft.findMany({ where: context.scope.isPlatformWide ? {} : { centreId: { in: context.scope.centreIds } }, orderBy: { createdAt: "desc" } })));
}

export async function POST(request: Request) {
  const context = await requireIntelligenceAccess();
  if ("error" in context) return context.error;
  try { return apiSuccess(await createProposalDraft(context.scope, proposalDraftSchema.parse(await request.json())), 201); }
  catch (error) { if (error instanceof ZodError) return validationError(error); if (error instanceof Error) return apiError(error.message, statusFromError(error)); return apiError("Proposal draft could not be created.", 500); }
}
