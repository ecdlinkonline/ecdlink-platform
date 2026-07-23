import { requireFundingUser } from "@/lib/api/funding-auth";
import { apiError, apiSuccess } from "@/lib/api/responses";
import { getFundingReportsFromDb } from "@/lib/repositories/funding";

export async function GET() {
  const context = await requireFundingUser();
  if ("error" in context) return context.error;
  if (!["super_admin", "funding_partner"].includes(context.authContext.role ?? "")) return apiError("You do not have access to funding reports.", 403);
  return apiSuccess(await getFundingReportsFromDb());
}
