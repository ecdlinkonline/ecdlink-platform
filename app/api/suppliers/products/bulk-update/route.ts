import { requireSupplierOwnership } from "@/lib/api/supplier-auth";
import { apiSuccess } from "@/lib/api/responses";

export async function POST() {
  const context = await requireSupplierOwnership("catalogue.manage");
  if ("error" in context) return context.error;
  return apiSuccess({ status: "Bulk supplier price update placeholder queued", next: "CSV/XLSX import validation workflow" }, 202);
}
