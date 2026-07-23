import { requireIdentityAdmin } from "@/lib/api/identity-auth";
import { apiError, apiSuccess } from "@/lib/api/responses";
import { removeUserFromCentre } from "@/lib/repositories/users";

export async function DELETE(_request: Request, { params }: { params: Promise<{ centreUserId: string }> }) {
  const context = await requireIdentityAdmin();
  if ("error" in context) return context.error;

  try {
    const { centreUserId } = await params;
    return apiSuccess(await removeUserFromCentre(centreUserId, context.internalUser.id));
  } catch {
    return apiError("Centre membership could not be removed.", 400);
  }
}
