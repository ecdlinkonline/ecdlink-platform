import { ZodError } from "zod";
import { requireSupplierAdmin } from "@/lib/api/supplier-auth";
import { apiError, apiSuccess, statusFromError, validationError } from "@/lib/api/responses";
import { resolveSupplierDbId } from "@/lib/repositories/suppliers";
import { setSupplierStatus } from "@/lib/services/suppliers";
import { supplierDecisionSchema } from "@/lib/validators/suppliers";

export async function POST(request: Request, { params }: { params: Promise<{ supplierId: string }> }) {
  const context = await requireSupplierAdmin();
  if ("error" in context) return context.error;
  try {
    const input = supplierDecisionSchema.parse(await request.json());
    if (!input.reason) return apiError("Suspension reason is required.", 422);
    const dbId = await resolveSupplierDbId((await params).supplierId);
    if (!dbId) return apiError("Supplier was not found.", 404);
    return apiSuccess(await setSupplierStatus(dbId, "Suspended", context.internalUser.id, input.reason));
  } catch (error) {
    if (error instanceof ZodError) return validationError(error);
    if (error instanceof Error) return apiError(error.message, statusFromError(error));
    return apiError("Supplier could not be suspended.", 500);
  }
}
