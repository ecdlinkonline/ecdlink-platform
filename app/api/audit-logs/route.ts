import { requireIdentityAdmin } from "@/lib/api/identity-auth";
import { apiSuccess } from "@/lib/api/responses";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  const context = await requireIdentityAdmin();
  if ("error" in context) return context.error;

  return apiSuccess(await prisma.auditLog.findMany({
    include: { actor: true },
    orderBy: { createdAt: "desc" },
    take: 250
  }));
}
