import { requireIntelligenceAccess } from "@/lib/api/intelligence-auth";
import { apiSuccess } from "@/lib/api/responses";
import { listInsights } from "@/lib/repositories/intelligence";

export async function GET() {
  const context = await requireIntelligenceAccess();
  if ("error" in context) return context.error;
  return apiSuccess(await listInsights(context.scope));
}
