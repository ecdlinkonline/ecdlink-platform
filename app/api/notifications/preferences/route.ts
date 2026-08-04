import { ZodError } from "zod";
import { requireFundingUser } from "@/lib/api/funding-auth";
import { apiError, apiSuccess, validationError } from "@/lib/api/responses";
import { getNotificationPreferences, setNotificationPreference } from "@/lib/notifications";
import { notificationPreferenceSchema } from "@/lib/validators/notifications";

export async function GET() { const context = await requireFundingUser(); return "error" in context ? context.error : apiSuccess(await getNotificationPreferences(context.internalUser.id)); }
export async function PUT(request: Request) {
  const context = await requireFundingUser(); if ("error" in context) return context.error;
  try { const input = notificationPreferenceSchema.parse(await request.json()); return apiSuccess(await setNotificationPreference(context.internalUser.id, input.type, input.delivery)); }
  catch (error) { if (error instanceof ZodError) return validationError(error); return apiError("Notification preference could not be saved.", 500); }
}
