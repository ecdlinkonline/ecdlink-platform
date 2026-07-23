import { requireMembershipAdmin } from "@/lib/api/membership-auth";
import { apiError, apiSuccess, statusFromError } from "@/lib/api/responses";
import { generateMembershipReceiptRecord } from "@/lib/services/memberships";

export async function POST(_request: Request, { params }: { params: Promise<{ membershipId: string }> }) {
  const context = await requireMembershipAdmin();
  if ("error" in context) return context.error;

  try {
    const { membershipId } = await params;
    return apiSuccess(await generateMembershipReceiptRecord(membershipId, context.actorUserId), 201);
  } catch (error) {
    if (error instanceof Error) return apiError(error.message, statusFromError(error));
    return apiError("Receipt could not be generated.", 500);
  }
}
