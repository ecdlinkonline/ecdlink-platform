import { requireSupplierOwnership } from "@/lib/api/supplier-auth";
import { apiSuccess } from "@/lib/api/responses";
import { getSupplierReportFromDb } from "@/lib/repositories/suppliers";

export async function GET() {
  const context = await requireSupplierOwnership();

  if ("error" in context) {
    return context.error;
  }

  const supplierIds =
    ("supplierIds" in context ? context.supplierIds : null) ??
    context.internalUser.supplierUsers.map(
      (membership) => membership.supplierId
    );

  if (context.authContext.role === "super_admin") {
    return apiSuccess(await getSupplierReportFromDb());
  }

  return apiSuccess(
    await getSupplierReportFromDb(supplierIds[0])
  );
}