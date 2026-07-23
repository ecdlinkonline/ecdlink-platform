import { requirePartnerAdmin } from "@/lib/api/partner-auth";
import { apiError, apiSuccess, statusFromError } from "@/lib/api/responses";
import { generatePartnerReminders } from "@/lib/services/partners";

export async function POST() {
  const context = await requirePartnerAdmin();
  if ("error" in context) return context.error;
  try {
    return apiSuccess(await generatePartnerReminders(context.internalUser.id));
  } catch (error) {
    if (error instanceof Error) return apiError(error.message, statusFromError(error));
    return apiError("Partner reminders could not be generated.", 500);
  }
}
