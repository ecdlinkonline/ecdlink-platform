import { ZodError } from "zod";
import { requireMembershipAdmin } from "@/lib/api/membership-auth";
import { apiError, apiSuccess, statusFromError, validationError } from "@/lib/api/responses";
import { generateMembershipInvoiceRecord } from "@/lib/services/memberships";
import { invoiceMembershipSchema } from "@/lib/validators/memberships";

export async function POST(request: Request, { params }: { params: Promise<{ membershipId: string }> }) {
  const context = await requireMembershipAdmin();
  if ("error" in context) return context.error;

  try {
    const { membershipId } = await params;
    const body = await request.json().catch(() => ({}));
    const input = invoiceMembershipSchema.parse(body);
    return apiSuccess(await generateMembershipInvoiceRecord(membershipId, input.dueDate, context.actorUserId), 201);
  } catch (error) {
    if (error instanceof ZodError) return validationError(error);
    if (error instanceof Error) return apiError(error.message, statusFromError(error));
    return apiError("Invoice could not be generated.", 500);
  }
}
