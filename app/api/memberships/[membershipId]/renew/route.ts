import { ZodError } from "zod";
import { requireMembershipAdmin } from "@/lib/api/membership-auth";
import { apiError, apiSuccess, statusFromError, validationError } from "@/lib/api/responses";
import { renewMembership } from "@/lib/services/memberships";
import { renewMembershipSchema } from "@/lib/validators/memberships";

export async function POST(request: Request, { params }: { params: Promise<{ membershipId: string }> }) {
  const context = await requireMembershipAdmin();
  if ("error" in context) return context.error;

  try {
    const { membershipId } = await params;
    const body = await request.json().catch(() => ({}));
    const input = renewMembershipSchema.parse(body);
    return apiSuccess(await renewMembership(membershipId, input, context.actorUserId), 201);
  } catch (error) {
    if (error instanceof ZodError) return validationError(error);
    if (error instanceof Error) return apiError(error.message, statusFromError(error));
    return apiError("Membership could not be renewed.", 500);
  }
}
