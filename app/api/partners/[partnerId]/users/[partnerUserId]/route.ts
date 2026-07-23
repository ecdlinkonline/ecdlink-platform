import { requirePartnerAdmin } from "@/lib/api/partner-auth";
import { apiError, apiSuccess, statusFromError } from "@/lib/api/responses";
import { removePartnerUser } from "@/lib/services/partners";

export async function DELETE(_: Request, { params }: { params: Promise<{ partnerUserId: string }> }) {
  const context = await requirePartnerAdmin();
  if ("error" in context) return context.error;
  try {
    return apiSuccess(await removePartnerUser((await params).partnerUserId, context.internalUser.id));
  } catch (error) {
    if (error instanceof Error) return apiError(error.message, statusFromError(error));
    return apiError("Partner user could not be removed.", 500);
  }
}
