import { ZodError } from "zod";
import { requireFundingUser } from "@/lib/api/funding-auth";
import { apiError, apiSuccess, validationError } from "@/lib/api/responses";
import { markAllNotificationsRead } from "@/lib/notifications";
import { notificationReadAllSchema } from "@/lib/validators/notifications";

export async function POST(request: Request) {
  const context = await requireFundingUser();
  if ("error" in context) return context.error;
  try { return apiSuccess(await markAllNotificationsRead(context.internalUser.id, notificationReadAllSchema.parse(await request.json()))); }
  catch (error) { if (error instanceof ZodError) return validationError(error); return apiError("Notifications could not be updated.", 500); }
}
