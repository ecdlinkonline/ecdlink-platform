import { requireMembershipAdmin } from "@/lib/api/membership-auth";
import { apiError, apiSuccess, statusFromError } from "@/lib/api/responses";
import { activateMembership } from "@/lib/services/memberships";

export async function POST(_request: Request, { params }: { params: Promise<{ membershipId: string }> }) {
  const context = await requireMembershipAdmin();
  if ("error" in context) return context.error;

  try {
    const { membershipId } = await params;
    return apiSuccess(await activateMembership(membershipId, context.actorUserId));
  } catch (error) {
    if (error instanceof Error) return apiError(error.message, statusFromError(error));
    return apiError("Membership could not be activated.", 500);
  }
}
