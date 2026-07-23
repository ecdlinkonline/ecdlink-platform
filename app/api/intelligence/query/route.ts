import { ZodError } from "zod";
import { requireIntelligenceAccess, rateLimitPlaceholder } from "@/lib/api/intelligence-auth";
import { apiError, apiSuccess, statusFromError, validationError } from "@/lib/api/responses";
import { submitIntelligenceQuery } from "@/lib/services/intelligence";
import { intelligenceQuerySchema } from "@/lib/validators/intelligence";

export async function POST(request: Request) {
  const context = await requireIntelligenceAccess();
  if ("error" in context) return context.error;
  if (!rateLimitPlaceholder().allowed) return apiError("Rate limit exceeded.", 429);
  try {
    return apiSuccess(await submitIntelligenceQuery(context.scope, intelligenceQuerySchema.parse(await request.json())), 201);
  } catch (error) {
    if (error instanceof ZodError) return validationError(error);
    if (error instanceof Error) return apiError(error.message, statusFromError(error));
    return apiError("Intelligence query could not be processed.", 500);
  }
}
