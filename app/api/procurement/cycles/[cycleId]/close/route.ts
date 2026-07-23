import { requireProcurementAdmin } from "@/lib/api/procurement-auth";
import { apiError, apiSuccess, statusFromError } from "@/lib/api/responses";
import { closeProcurementCycle } from "@/lib/services/procurement";

export async function POST(_request: Request, { params }: { params: Promise<{ cycleId: string }> }) {
  const context = await requireProcurementAdmin();
  if ("error" in context) return context.error;
  try {
    const { cycleId } = await params;
    return apiSuccess(await closeProcurementCycle(cycleId, context.internalUser.id));
  } catch (error) {
    if (error instanceof Error) return apiError(error.message, statusFromError(error));
    return apiError("Procurement cycle could not be closed.", 500);
  }
}
