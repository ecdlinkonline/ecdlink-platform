import { requireIntelligenceAccess } from "@/lib/api/intelligence-auth";
import { apiError, apiSuccess } from "@/lib/api/responses";
import { getQuery } from "@/lib/repositories/intelligence";

export async function GET(_: Request, { params }: { params: Promise<{ queryId: string }> }) {
  const context = await requireIntelligenceAccess();
  if ("error" in context) return context.error;
  const query = await getQuery(context.scope, (await params).queryId);
  if (!query) return apiError("Intelligence query was not found.", 404);
  return apiSuccess(query);
}
