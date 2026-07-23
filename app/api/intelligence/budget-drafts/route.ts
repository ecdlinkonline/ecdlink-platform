import { ZodError } from "zod";
import { requireIntelligenceAccess } from "@/lib/api/intelligence-auth";
import { apiError, apiSuccess, statusFromError, validationError } from "@/lib/api/responses";
import { prisma } from "@/lib/db/prisma";
import { toPlain } from "@/lib/repositories/intelligence";
import { createBudgetDraft } from "@/lib/services/intelligence";
import { budgetDraftSchema } from "@/lib/validators/intelligence";

export async function GET() {
  const context = await requireIntelligenceAccess();
  if ("error" in context) return context.error;
  return apiSuccess(toPlain(await prisma.intelligenceBudgetDraft.findMany({ where: context.scope.isPlatformWide ? {} : { centreId: { in: context.scope.centreIds } }, include: { items: true }, orderBy: { createdAt: "desc" } })));
}

export async function POST(request: Request) {
  const context = await requireIntelligenceAccess();
  if ("error" in context) return context.error;
  try { return apiSuccess(await createBudgetDraft(context.scope, budgetDraftSchema.parse(await request.json())), 201); }
  catch (error) { if (error instanceof ZodError) return validationError(error); if (error instanceof Error) return apiError(error.message, statusFromError(error)); return apiError("Budget draft could not be created.", 500); }
}
