import { requireIntelligenceAccess } from "@/lib/api/intelligence-auth";
import { apiError, apiSuccess, statusFromError } from "@/lib/api/responses";
import { runIntelligenceScan } from "@/lib/services/intelligence";

export async function POST() {
  const context = await requireIntelligenceAccess();
  if ("error" in context) return context.error;
  try { return apiSuccess(await runIntelligenceScan(context.scope)); }
  catch (error) { if (error instanceof Error) return apiError(error.message, statusFromError(error)); return apiError("Intelligence scan could not run.", 500); }
}
