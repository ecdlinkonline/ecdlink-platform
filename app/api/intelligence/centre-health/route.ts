import { ZodError } from "zod";
import { requireIntelligenceAccess } from "@/lib/api/intelligence-auth";
import { apiError, apiSuccess, validationError } from "@/lib/api/responses";
import { getCentreHealth } from "@/lib/services/intelligence";
import { centreHealthSchema } from "@/lib/validators/intelligence";

export async function GET(request: Request) {
  const context = await requireIntelligenceAccess();
  if ("error" in context) return context.error;
  try { return apiSuccess(await getCentreHealth(context.scope, centreHealthSchema.parse(Object.fromEntries(new URL(request.url).searchParams.entries())))); }
  catch (error) { if (error instanceof ZodError) return validationError(error); return apiError("Centre health could not be calculated.", 500); }
}
