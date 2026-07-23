import { requirePartnerModuleUser } from "@/lib/api/partner-auth";
import { apiError, apiSuccess } from "@/lib/api/responses";
import { getImpactCentreFromDb } from "@/lib/repositories/donors";

export async function GET(_: Request, { params }: { params: Promise<{ centreId: string }> }) {
  const context = await requirePartnerModuleUser();
  if ("error" in context) return context.error;
  const centre = await getImpactCentreFromDb((await params).centreId);
  if (!centre) return apiError("Centre summary was not found.", 404);
  return apiSuccess(centre);
}
