import { requireFundingAdmin } from "@/lib/api/funding-auth";
import { apiError, apiSuccess, statusFromError } from "@/lib/api/responses";
import { createFundingReminders } from "@/lib/services/funding";

export async function POST() {
  const context = await requireFundingAdmin();
  if ("error" in context) return context.error;

  try {
    return apiSuccess(await createFundingReminders(context.internalUser.id));
  } catch (error) {
    if (error instanceof Error) return apiError(error.message, statusFromError(error));
    return apiError("Funding reminders could not be generated.", 500);
  }
}
