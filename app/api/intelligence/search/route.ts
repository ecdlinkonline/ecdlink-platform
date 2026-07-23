import { ZodError } from "zod";
import { requireIntelligenceAccess } from "@/lib/api/intelligence-auth";
import { apiError, apiSuccess, validationError } from "@/lib/api/responses";
import { createAuditLog } from "@/lib/repositories/audit-logs";
import { smartSearch } from "@/lib/services/intelligence";
import { searchSchema } from "@/lib/validators/intelligence";

export async function GET(request: Request) {
  const context = await requireIntelligenceAccess();
  if ("error" in context) return context.error;
  try {
    const params = Object.fromEntries(new URL(request.url).searchParams.entries());
    const input = searchSchema.parse(params);
    const result = await smartSearch(context.scope, input);
    await createAuditLog({ actorUserId: context.scope.userId, action: "intelligence.search.performed", entityType: "IntelligenceSearch", metadata: { q: input.q, total: result.total } });
    return apiSuccess(result);
  } catch (error) {
    if (error instanceof ZodError) return validationError(error);
    return apiError("Search could not be completed.", 500);
  }
}
