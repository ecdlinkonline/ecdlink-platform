import { requirePartnerAdmin } from "@/lib/api/partner-auth";
import { apiError, apiSuccess, statusFromError } from "@/lib/api/responses";
import { approveImpactReport } from "@/lib/services/partners";

export async function POST(_: Request, { params }: { params: Promise<{ reportId: string }> }) {
  const context = await requirePartnerAdmin();
  if ("error" in context) return context.error;
  try {
    return apiSuccess(await approveImpactReport((await params).reportId, context.internalUser.id));
  } catch (error) {
    if (error instanceof Error) return apiError(error.message, statusFromError(error));
    return apiError("Impact report could not be approved.", 500);
  }
}
