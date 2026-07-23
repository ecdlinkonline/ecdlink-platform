import { requirePartnerModuleUser } from "@/lib/api/partner-auth";
import { apiSuccess } from "@/lib/api/responses";
import { listImpactProjectsFromDb } from "@/lib/repositories/donors";

export async function GET() {
  const context = await requirePartnerModuleUser();
  if ("error" in context) return context.error;
  return apiSuccess(await listImpactProjectsFromDb());
}
