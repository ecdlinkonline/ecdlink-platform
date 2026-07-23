import { requirePartnerAdmin } from "@/lib/api/partner-auth";
import { apiError, apiSuccess, statusFromError } from "@/lib/api/responses";
import { resolvePartnerDbId } from "@/lib/repositories/donors";
import { setPartnerStatus } from "@/lib/services/partners";

export async function POST(request: Request, { params }: { params: Promise<{ partnerId: string }> }) {
  const context = await requirePartnerAdmin();
  if ("error" in context) return context.error;
  try {
    const body = await request.json().catch(() => ({}));
    if (!body.reason) return apiError("Suspension reason is required.", 422);
    const dbId = await resolvePartnerDbId((await params).partnerId);
    if (!dbId) return apiError("Partner organisation was not found.", 404);
    return apiSuccess(await setPartnerStatus(dbId, "Suspended", context.internalUser.id, body.reason));
  } catch (error) {
    if (error instanceof Error) return apiError(error.message, statusFromError(error));
    return apiError("Partner organisation could not be suspended.", 500);
  }
}
