import { requireSupplierAdmin } from "@/lib/api/supplier-auth";
import { apiError, apiSuccess, statusFromError } from "@/lib/api/responses";
import { resolveSupplierDbId } from "@/lib/repositories/suppliers";
import { setSupplierStatus } from "@/lib/services/suppliers";

export async function POST(_: Request, { params }: { params: Promise<{ supplierId: string }> }) {
  const context = await requireSupplierAdmin();
  if ("error" in context) return context.error;
  try {
    const dbId = await resolveSupplierDbId((await params).supplierId);
    if (!dbId) return apiError("Supplier was not found.", 404);
    return apiSuccess(await setSupplierStatus(dbId, "Archived", context.internalUser.id));
  } catch (error) {
    if (error instanceof Error) return apiError(error.message, statusFromError(error));
    return apiError("Supplier could not be archived.", 500);
  }
}
