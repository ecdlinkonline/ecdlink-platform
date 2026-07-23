import { requireSupplierOwnership } from "@/lib/api/supplier-auth";
import { apiError, apiSuccess } from "@/lib/api/responses";
import { prisma } from "@/lib/db/prisma";

export async function GET(
  _: Request,
  {
    params,
  }: {
    params: Promise<{ quotationId: string }>;
  }
) {
  const context = await requireSupplierOwnership();

  if ("error" in context) {
    return context.error;
  }

  const supplierIds =
    ("supplierIds" in context ? context.supplierIds : null) ??
    context.internalUser.supplierUsers.map(
      (membership) => membership.supplierId
    );

  const { quotationId } = await params;

  const quotation = await prisma.supplierQuotation.findFirst({
    where: {
      OR: [
        { id: quotationId },
        { quotationNumber: quotationId },
      ],
    },
    include: {
      items: true,
      supplier: true,
    },
  });

  if (!quotation) {
    return apiError(
      "Supplier quotation was not found.",
      404
    );
  }

  if (
    context.authContext.role !== "super_admin" &&
    !supplierIds.includes(quotation.supplierId)
  ) {
    return apiError(
      "You can only access your linked supplier quotations.",
      403
    );
  }

  return apiSuccess(quotation);
}