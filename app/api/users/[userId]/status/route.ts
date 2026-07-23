import { ZodError } from "zod";
import { requireIdentityAdmin } from "@/lib/api/identity-auth";
import { apiError, apiSuccess, validationError } from "@/lib/api/responses";
import { setUserStatus } from "@/lib/repositories/users";
import { changeUserStatusSchema } from "@/lib/validators/identity";

export async function PATCH(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const context = await requireIdentityAdmin();
  if ("error" in context) return context.error;

  try {
    const { userId } = await params;
    const input = changeUserStatusSchema.parse(await request.json());
    return apiSuccess(await setUserStatus(userId, input.status, context.internalUser.id));
  } catch (error) {
    if (error instanceof ZodError) return validationError(error);
    return apiError("User status could not be updated.", 400);
  }
}
