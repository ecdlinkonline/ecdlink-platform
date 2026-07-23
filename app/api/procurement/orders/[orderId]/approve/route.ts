import { ZodError } from "zod";
import { requireProcurementAdmin } from "@/lib/api/procurement-auth";
import { apiError, apiSuccess, statusFromError, validationError } from "@/lib/api/responses";
import { reviewProcurementOrder } from "@/lib/services/procurement";
import { reviewProcurementOrderSchema } from "@/lib/validators/procurement";

export async function POST(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const context = await requireProcurementAdmin();
  if ("error" in context) return context.error;
  try {
    const { orderId } = await params;
    const input = reviewProcurementOrderSchema.parse(await request.json().catch(() => ({})));
    return apiSuccess(await reviewProcurementOrder(orderId, "approve", input.notes, context.internalUser.id));
  } catch (error) {
    if (error instanceof ZodError) return validationError(error);
    if (error instanceof Error) return apiError(error.message, statusFromError(error));
    return apiError("Order could not be approved.", 500);
  }
}
