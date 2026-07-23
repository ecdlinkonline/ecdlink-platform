import { requireComplianceAdmin } from "@/lib/api/compliance-auth";
import { apiSuccess } from "@/lib/api/responses";
import { getComplianceReportsFromDb } from "@/lib/repositories/compliance";

export async function GET() {
  const context = await requireComplianceAdmin();
  if ("error" in context) return context.error;
  return apiSuccess(await getComplianceReportsFromDb());
}
