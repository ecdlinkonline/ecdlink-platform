import { requireIntelligenceAccess } from "@/lib/api/intelligence-auth";
import { apiError, apiSuccess } from "@/lib/api/responses";
import { prisma } from "@/lib/db/prisma";
import { toPlain } from "@/lib/repositories/intelligence";

export async function GET(_: Request, { params }: { params: Promise<{ reportId: string }> }) {
  const context = await requireIntelligenceAccess();
  if ("error" in context) return context.error;
  const report = await prisma.intelligenceResponse.findUnique({ where: { id: (await params).reportId }, include: { query: true, sourceReferences: true } });
  if (!report || report.responseType !== "Report") return apiError("Report was not found.", 404);
  if (!context.scope.isPlatformWide && report.query.userId !== context.scope.userId) return apiError("You can only access your own generated reports.", 403);
  return apiSuccess(toPlain(report));
}
