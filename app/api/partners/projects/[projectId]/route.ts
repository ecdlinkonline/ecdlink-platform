import { requirePartnerModuleUser } from "@/lib/api/partner-auth";
import { apiError, apiSuccess } from "@/lib/api/responses";
import { getImpactProjectFromDb } from "@/lib/repositories/donors";

export async function GET(_: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const context = await requirePartnerModuleUser();
  if ("error" in context) return context.error;
  const project = await getImpactProjectFromDb((await params).projectId);
  if (!project) return apiError("Impact project was not found.", 404);
  return apiSuccess(project);
}
