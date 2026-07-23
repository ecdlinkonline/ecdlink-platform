import { requireSupplierOwnership } from "@/lib/api/supplier-auth";
import { apiSuccess } from "@/lib/api/responses";
import { getSupplierOrdersFromDb } from "@/lib/repositories/suppliers";

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
    return apiSuccess(
      await getSupplierOrdersFromDb("")
    );
  }

  const orders = await Promise.all(
    supplierIds.map((supplierId) =>
      getSupplierOrdersFromDb(supplierId)
    )
  );

  return apiSuccess(orders.flat());
}