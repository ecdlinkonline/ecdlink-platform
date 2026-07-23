import { ZodError } from "zod";
import { requireMembershipAdmin } from "@/lib/api/membership-auth";
import { apiError, apiSuccess, statusFromError, validationError } from "@/lib/api/responses";
import { cancelMembership } from "@/lib/services/memberships";
import { cancelMembershipSchema } from "@/lib/validators/memberships";

export async function POST(request: Request, { params }: { params: Promise<{ membershipId: string }> }) {
  const context = await requireMembershipAdmin();
  if ("error" in context) return context.error;

  try {
    const { membershipId } = await params;
    const input = cancelMembershipSchema.parse(await request.json());
    return apiSuccess(await cancelMembership(membershipId, input, context.actorUserId));
  } catch (error) {
    if (error instanceof ZodError) return validationError(error);
    if (error instanceof Error) return apiError(error.message, statusFromError(error));
    return apiError("Membership could not be cancelled.", 500);
  }
}
