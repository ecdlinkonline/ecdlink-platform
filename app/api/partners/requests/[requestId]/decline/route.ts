import { requirePartnerAdmin } from "@/lib/api/partner-auth";
import { apiError, apiSuccess, statusFromError } from "@/lib/api/responses";
import { setPartnershipRequestStatus } from "@/lib/services/partners";

export async function POST(request: Request, { params }: { params: Promise<{ requestId: string }> }) {
  const context = await requirePartnerAdmin();
  if ("error" in context) return context.error;
  try { const body = await request.json().catch(() => ({})); return apiSuccess(await setPartnershipRequestStatus((await params).requestId, "Declined", context.internalUser.id, body.reason)); }
  catch (error) { if (error instanceof Error) return apiError(error.message, statusFromError(error)); return apiError("Request could not be declined.", 500); }
}
