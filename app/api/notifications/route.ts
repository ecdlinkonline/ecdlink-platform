import { ZodError } from "zod";
import { requireFundingUser } from "@/lib/api/funding-auth";
import { apiError, apiSuccess, validationError } from "@/lib/api/responses";
import { countUnreadNotificationsForUser, listNotificationsForUser } from "@/lib/notifications";
import { notificationListSchema } from "@/lib/validators/notifications";

export async function GET(request: Request) {
  const context = await requireFundingUser();
  if ("error" in context) return context.error;
  try {
    const url = new URL(request.url);
    const filters = notificationListSchema.parse(Object.fromEntries(url.searchParams));
    const [page, unreadCount] = await Promise.all([listNotificationsForUser(context.internalUser.id, filters), countUnreadNotificationsForUser(context.internalUser.id)]);
    return apiSuccess({ ...page, unreadCount });
  } catch (error) {
    if (error instanceof ZodError) return validationError(error);
    return apiError("Notifications could not be loaded.", 500);
  }
}
