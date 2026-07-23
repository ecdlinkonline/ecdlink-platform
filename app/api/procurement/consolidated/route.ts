import { requireProcurementSupplier } from "@/lib/api/procurement-auth";
import { apiSuccess } from "@/lib/api/responses";
import { listConsolidatedSupplierOrdersFromDb } from "@/lib/repositories/procurement";

export async function GET() {
  const context = await requireProcurementSupplier();
  if ("error" in context) return context.error;
  return apiSuccess(await listConsolidatedSupplierOrdersFromDb());
}
