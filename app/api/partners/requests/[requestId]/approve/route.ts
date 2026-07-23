import { requirePartnerAdmin } from "@/lib/api/partner-auth";
import { apiError, apiSuccess, statusFromError } from "@/lib/api/responses";
import { setPartnershipRequestStatus } from "@/lib/services/partners";

export async function POST(_: Request, { params }: { params: Promise<{ requestId: string }> }) {
  const context = await requirePartnerAdmin();
  if ("error" in context) return context.error;
  try { return apiSuccess(await setPartnershipRequestStatus((await params).requestId, "Approved", context.internalUser.id)); }
  catch (error) { if (error instanceof Error) return apiError(error.message, statusFromError(error)); return apiError("Request could not be approved.", 500); }
}
