import { ZodError } from "zod";
import { requireMembershipAdmin, requireMembershipApiUser } from "@/lib/api/membership-auth";
import { apiError, apiSuccess, statusFromError, validationError } from "@/lib/api/responses";
import { getMembershipFromDatabase, updateMembership } from "@/lib/services/memberships";
import { updateMembershipSchema } from "@/lib/validators/memberships";

export async function GET(_request: Request, { params }: { params: Promise<{ membershipId: string }> }) {
  const context = await requireMembershipApiUser();
  if ("error" in context) return context.error;

  const { membershipId } = await params;
  const membership = await getMembershipFromDatabase(membershipId);
  if (!membership) return apiError("Membership record not found.", 404);
  if (context.authContext.role === "ecd_centre" && membership.centreId !== context.centreId) {
    return apiError("You can only view your own centre membership.", 403);
  }

  return apiSuccess(membership);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ membershipId: string }> }) {
  const context = await requireMembershipAdmin();
  if ("error" in context) return context.error;

  try {
    const { membershipId } = await params;
    const input = updateMembershipSchema.parse(await request.json());
    return apiSuccess(await updateMembership(membershipId, input, context.actorUserId));
  } catch (error) {
    if (error instanceof ZodError) return validationError(error);
    if (error instanceof Error) return apiError(error.message, statusFromError(error));
    return apiError("Membership could not be updated.", 500);
  }
}
