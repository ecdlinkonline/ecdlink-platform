import { requirePartnerOwnership } from "@/lib/api/partner-auth";
import { apiError, apiSuccess } from "@/lib/api/responses";
import { prisma } from "@/lib/db/prisma";

export async function GET(_: Request, { params }: { params: Promise<{ updateId: string }> }) {
  const context = await requirePartnerOwnership();
  if ("error" in context) return context.error;
  const update = await prisma.projectUpdate.findUnique({ where: { id: (await params).updateId }, include: { project: true } });
  if (!update) return apiError("Project update was not found.", 404);
  if (context.authContext.role === "donor" && !["Partner", "Public"].includes(update.visibility)) return apiError("Project update is not visible to partners.", 403);
  return apiSuccess(update);
}
