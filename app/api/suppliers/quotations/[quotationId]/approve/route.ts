import { requireSupplierAdmin } from "@/lib/api/supplier-auth";
import { apiError, apiSuccess, statusFromError } from "@/lib/api/responses";
import { prisma } from "@/lib/db/prisma";
import { setQuotationStatus } from "@/lib/services/suppliers";

export async function POST(_: Request, { params }: { params: Promise<{ quotationId: string }> }) {
  const context = await requireSupplierAdmin();
  if ("error" in context) return context.error;
  try {
    const quotation = await prisma.supplierQuotation.findFirst({ where: { OR: [{ id: (await params).quotationId }, { quotationNumber: (await params).quotationId }] } });
    if (!quotation) return apiError("Supplier quotation was not found.", 404);
    return apiSuccess(await setQuotationStatus(quotation.id, "APPROVED", context.internalUser.id));
  } catch (error) {
    if (error instanceof Error) return apiError(error.message, statusFromError(error));
    return apiError("Supplier quotation could not be approved.", 500);
  }
}
