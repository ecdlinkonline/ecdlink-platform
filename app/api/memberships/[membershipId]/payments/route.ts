import { ZodError } from "zod";
import { requireMembershipAdmin } from "@/lib/api/membership-auth";
import { apiError, apiSuccess, statusFromError, validationError } from "@/lib/api/responses";
import { recordMembershipPayment } from "@/lib/services/memberships";
import { membershipPaymentSchema } from "@/lib/validators/memberships";

export async function POST(request: Request, { params }: { params: Promise<{ membershipId: string }> }) {
  const context = await requireMembershipAdmin();
  if ("error" in context) return context.error;

  try {
    const { membershipId } = await params;
    const input = membershipPaymentSchema.parse(await request.json());
    return apiSuccess(await recordMembershipPayment(membershipId, input, context.actorUserId), 201);
  } catch (error) {
    if (error instanceof ZodError) return validationError(error);
    if (error instanceof Error) return apiError(error.message, statusFromError(error));
    return apiError("Payment could not be recorded.", 500);
  }
}
