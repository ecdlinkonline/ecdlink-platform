import { requireSupplierAdmin } from "@/lib/api/supplier-auth";
import { apiError, apiSuccess, statusFromError } from "@/lib/api/responses";
import { removeSupplierUser } from "@/lib/services/suppliers";

export async function DELETE(_: Request, { params }: { params: Promise<{ supplierUserId: string }> }) {
  const context = await requireSupplierAdmin();
  if ("error" in context) return context.error;
  try {
    return apiSuccess(await removeSupplierUser((await params).supplierUserId, context.internalUser.id));
  } catch (error) {
    if (error instanceof Error) return apiError(error.message, statusFromError(error));
    return apiError("Supplier user could not be removed.", 500);
  }
}
