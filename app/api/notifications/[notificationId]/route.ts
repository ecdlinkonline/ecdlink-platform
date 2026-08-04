import { ZodError } from "zod";
import { requireFundingUser } from "@/lib/api/funding-auth";
import { apiError, apiSuccess, validationError } from "@/lib/api/responses";
import { setNotificationReadState } from "@/lib/notifications";
import { notificationReadSchema } from "@/lib/validators/notifications";
import { enforceRateLimit, requireTrustedOrigin } from "@/lib/api/security";

export async function PATCH(request: Request, { params }: { params: Promise<{ notificationId: string }> }) {
  const context = await requireFundingUser();
  if ("error" in context) return context.error;
  const originError = requireTrustedOrigin(request); if (originError) return originError;
  const rateError = await enforceRateLimit("notification_mutation", context.internalUser.id); if (rateError) return rateError;
  try {
    const { notificationId } = await params;
    const input = notificationReadSchema.parse(await request.json());
    const updated = await setNotificationReadState(context.internalUser.id, notificationId, input.read);
    return updated ? apiSuccess({ updated: true }) : apiError("Notification was not found.", 404);
  } catch (error) {
    if (error instanceof ZodError) return validationError(error);
    return apiError("Notification could not be updated.", 500);
  }
}
