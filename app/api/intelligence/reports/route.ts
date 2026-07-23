import { ZodError } from "zod";
import { requireIntelligenceAccess } from "@/lib/api/intelligence-auth";
import { apiError, apiSuccess, statusFromError, validationError } from "@/lib/api/responses";
import { prisma } from "@/lib/db/prisma";
import { toPlain } from "@/lib/repositories/intelligence";
import { createIntelligenceReport } from "@/lib/services/intelligence";
import { reportSchema } from "@/lib/validators/intelligence";

export async function GET() {
  const context = await requireIntelligenceAccess();
  if ("error" in context) return context.error;
  const where = context.scope.isPlatformWide ? { responseType: "Report" } : { responseType: "Report", query: { userId: context.scope.userId } };
  return apiSuccess(toPlain(await prisma.intelligenceResponse.findMany({
    where,
    include: { query: true, sourceReferences: true },
    orderBy: { generatedAt: "desc" },
    take: 50
  })));
}

export async function POST(request: Request) {
  const context = await requireIntelligenceAccess();
  if ("error" in context) return context.error;
  try { return apiSuccess(await createIntelligenceReport(context.scope, reportSchema.parse(await request.json())), 201); }
  catch (error) { if (error instanceof ZodError) return validationError(error); if (error instanceof Error) return apiError(error.message, statusFromError(error)); return apiError("Report could not be generated.", 500); }
}
