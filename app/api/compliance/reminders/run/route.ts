import { requireComplianceAdmin } from "@/lib/api/compliance-auth";
import { apiError, apiSuccess, statusFromError } from "@/lib/api/responses";
import { runComplianceReminders } from "@/lib/services/compliance";

export async function POST() {
  const context = await requireComplianceAdmin();
  if ("error" in context) return context.error;
  try {
    return apiSuccess(await runComplianceReminders(context.internalUser.id));
  } catch (error) {
    if (error instanceof Error) return apiError(error.message, statusFromError(error));
    return apiError("Compliance reminders could not be run.", 500);
  }
}
