import { requireSupplierOwnership } from "@/lib/api/supplier-auth";
import { apiError, apiSuccess } from "@/lib/api/responses";
import { prisma } from "@/lib/db/prisma";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ invoiceId: string }> }
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

  const { invoiceId } = await params;

  const invoice = await prisma.supplierInvoice.findFirst({
    where: {
      OR: [
        { id: invoiceId },
        { invoiceNumber: invoiceId },
      ],
    },
    include: {
      payments: true,
      supplier: true,
      supplierOrder: true,
    },
  });

  if (!invoice) {
    return apiError(
      "Supplier invoice was not found.",
      404
    );
  }

  if (
    context.authContext.role !== "super_admin" &&
    !supplierIds.includes(invoice.supplierId)
  ) {
    return apiError(
      "You can only access your linked supplier invoices.",
      403
    );
  }

  return apiSuccess(invoice);
}