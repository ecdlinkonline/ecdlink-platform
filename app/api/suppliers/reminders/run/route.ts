import { requireSupplierAdmin } from "@/lib/api/supplier-auth";
import { apiError, apiSuccess, statusFromError } from "@/lib/api/responses";
import { generateSupplierReminders } from "@/lib/services/suppliers";

export async function POST() {
  const context = await requireSupplierAdmin();
  if ("error" in context) return context.error;
  try {
    return apiSuccess(await generateSupplierReminders(context.internalUser.id));
  } catch (error) {
    if (error instanceof Error) return apiError(error.message, statusFromError(error));
    return apiError("Supplier reminders could not be generated.", 500);
  }
}
